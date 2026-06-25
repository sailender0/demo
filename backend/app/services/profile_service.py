import asyncio
import uuid
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings

settings = get_settings()

GITHUB_API = "https://api.github.com"


async def _jira_details(email: str) -> dict | None:
    if not all([settings.jira_base_url, settings.jira_email, settings.jira_api_token]):
        return None

    auth = (settings.jira_email, settings.jira_api_token)
    base = f"{settings.jira_base_url}/rest/api/3"

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Resolve SSO email → Jira accountId
        user_resp = await client.get(
            f"{base}/user/search",
            params={"query": email, "maxResults": 1},
            auth=auth,
        )
        if user_resp.status_code != 200 or not user_resp.json():
            return None
        u = user_resp.json()[0]
        account_id = u["accountId"]

        # 2. Open / in-progress issues assigned to this user
        issues_resp = await client.get(
            f"{base}/search",
            params={
                "jql": f'assignee="{account_id}" AND statusCategory != Done ORDER BY updated DESC',
                "maxResults": 10,
                "fields": "summary,status,priority,issuetype,updated",
            },
            auth=auth,
        )
        issues = []
        if issues_resp.status_code == 200:
            for i in issues_resp.json().get("issues", []):
                f = i["fields"]
                issues.append({
                    "key": i["key"],
                    "summary": f.get("summary"),
                    "status": f.get("status", {}).get("name"),
                    "priority": f.get("priority", {}).get("name"),
                    "type": f.get("issuetype", {}).get("name"),
                    "url": f"{settings.jira_base_url}/browse/{i['key']}",
                })

        # 3. Recently resolved
        resolved_resp = await client.get(
            f"{base}/search",
            params={
                "jql": f'assignee="{account_id}" AND statusCategory = Done ORDER BY updated DESC',
                "maxResults": 5,
                "fields": "summary,status,updated",
            },
            auth=auth,
        )
        resolved = []
        if resolved_resp.status_code == 200:
            for i in resolved_resp.json().get("issues", []):
                resolved.append({
                    "key": i["key"],
                    "summary": i["fields"].get("summary"),
                    "url": f"{settings.jira_base_url}/browse/{i['key']}",
                })

    return {
        "connected": True,
        "site_url": settings.jira_base_url,
        "profile": {
            "account_id": account_id,
            "display_name": u.get("displayName"),
            "email": u.get("emailAddress"),
            "avatar": u.get("avatarUrls", {}).get("48x48"),
            "active": u.get("active", True),
        },
        "open_issues": issues,
        "recently_resolved": resolved,
    }


async def _github_details(email: str) -> dict | None:
    if not settings.github_token:
        return None

    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    org = settings.github_org
    github_username = None

    async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
        # Method 1: SAML identity list (works if org uses SAML SSO)
        if org:
            saml_resp = await client.get(
                f"{GITHUB_API}/orgs/{org}/credential-authorizations",
            )
            if saml_resp.status_code == 200:
                for auth in saml_resp.json():
                    if email.lower() in str(auth.get("authorized_credential_note", "")).lower():
                        github_username = auth.get("login")
                        break

        # Method 2: search by email (works if GitHub profile email is public)
        if not github_username:
            search_resp = await client.get(
                f"{GITHUB_API}/search/users",
                params={"q": f"{email} in:email type:user", "per_page": 1},
            )
            items = search_resp.json().get("items", [])
            if items:
                github_username = items[0]["login"]

        # Method 3: search by name from email local-part (fallback when email is private)
        if not github_username:
            name_query = email.split("@")[0].replace(".", " ").replace("_", " ")
            if org:
                name_query += f" org:{org}"
            name_resp = await client.get(
                f"{GITHUB_API}/search/users",
                params={"q": name_query, "per_page": 1},
            )
            items = name_resp.json().get("items", [])
            if items:
                github_username = items[0]["login"]

        if not github_username:
            return None

        # Full profile
        profile_resp = await client.get(f"{GITHUB_API}/users/{github_username}")
        if profile_resp.status_code != 200:
            return None
        u = profile_resp.json()

        # Open PRs in the org
        pr_query = f"author:{github_username} is:pr is:open org:{org}" if org else f"author:{github_username} is:pr is:open"
        prs_resp = await client.get(
            f"{GITHUB_API}/search/issues",
            params={"q": pr_query, "per_page": 5},
        )
        prs = []
        if prs_resp.status_code == 200:
            for p in prs_resp.json().get("items", []):
                prs.append({
                    "title": p["title"],
                    "repo": p["repository_url"].split("/")[-1],
                    "url": p["html_url"],
                    "state": "open",
                    "number": p["number"],
                })

        # Recent commits via events API
        events_resp = await client.get(
            f"{GITHUB_API}/users/{github_username}/events/public",
            params={"per_page": 30},
        )
        commits = []
        if events_resp.status_code == 200:
            for event in events_resp.json():
                if event.get("type") == "PushEvent":
                    repo = event["repo"]["name"].split("/")[-1]
                    for commit in event["payload"].get("commits", [])[:2]:
                        commits.append({
                            "message": commit["message"].split("\n")[0][:80],
                            "repo": repo,
                            "sha": commit["sha"][:7],
                            "url": f"https://github.com/{event['repo']['name']}/commit/{commit['sha']}",
                        })
                if len(commits) >= 5:
                    break

    return {
        "connected": True,
        "profile": {
            "login": u.get("login"),
            "name": u.get("name"),
            "avatar": u.get("avatar_url"),
            "profile_url": u.get("html_url"),
            "public_repos": u.get("public_repos"),
            "followers": u.get("followers"),
        },
        "recent_prs": prs,
        "recent_commits": commits,
    }


async def _gitlab_details(email: str) -> dict | None:
    if not settings.gitlab_token:
        return None

    base = f"{settings.gitlab_url.rstrip('/')}/api/v4"
    headers = {"PRIVATE-TOKEN": settings.gitlab_token}

    async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
        # 1. Find user by SSO email
        search_resp = await client.get(f"{base}/users", params={"search": email, "per_page": 5})
        if search_resp.status_code != 200:
            return None

        users = search_resp.json()
        user = next((u for u in users if u.get("public_email", "").lower() == email.lower()
                     or u.get("email", "").lower() == email.lower()), None)
        if not user and users:
            user = users[0]
        if not user:
            return None

        uid = user["id"]

        # 2. Open merge requests authored by this user
        mrs_resp = await client.get(
            f"{base}/merge_requests",
            params={"author_id": uid, "state": "opened", "per_page": 5, "scope": "all"},
        )
        mrs = []
        if mrs_resp.status_code == 200:
            for mr in mrs_resp.json():
                mrs.append({
                    "title": mr.get("title"),
                    "state": mr.get("state"),
                    "url": mr.get("web_url"),
                    "repo": mr.get("references", {}).get("full", "").split("!")[0],
                    "iid": mr.get("iid"),
                })

        # 3. Recent commits via events
        events_resp = await client.get(
            f"{base}/users/{uid}/events",
            params={"action": "pushed", "per_page": 30},
        )
        commits = []
        if events_resp.status_code == 200:
            for event in events_resp.json():
                for commit in (event.get("push_data", {}).get("commits") or [])[:2]:
                    commits.append({
                        "message": commit.get("message", "").splitlines()[0][:80],
                        "repo": event.get("project_id"),
                        "url": f"{settings.gitlab_url}/{event.get('project_id', '')}/-/commit/{commit.get('id', '')}",
                    })
                if len(commits) >= 5:
                    break

    return {
        "connected": True,
        "profile": {
            "id": uid,
            "name": user.get("name"),
            "username": user.get("username"),
            "avatar": user.get("avatar_url"),
            "profile_url": user.get("web_url"),
        },
        "open_mrs": mrs,
        "recent_commits": commits,
    }


async def _teams_details(db: AsyncSession, tenant_id: uuid.UUID, entra_oid: str) -> dict | None:
    from app.services.teams_service import ensure_teams_token
    try:
        token = await ensure_teams_token(db, tenant_id)
    except Exception:
        return None

    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
        profile_resp = await client.get(
            f"https://graph.microsoft.com/v1.0/users/{entra_oid}",
            params={"$select": "id,displayName,mail,jobTitle,department,officeLocation,mobilePhone"},
        )
        if profile_resp.status_code != 200:
            return None
        u = profile_resp.json()

        teams_resp = await client.get(
            f"https://graph.microsoft.com/v1.0/users/{entra_oid}/joinedTeams",
            params={"$select": "id,displayName,description"},
        )
        teams = []
        if teams_resp.status_code == 200:
            for t in teams_resp.json().get("value", [])[:5]:
                teams.append({"id": t.get("id"), "name": t.get("displayName"), "description": t.get("description")})

        presence_resp = await client.get(
            f"https://graph.microsoft.com/v1.0/users/{entra_oid}/presence",
        )
        presence = None
        if presence_resp.status_code == 200:
            p = presence_resp.json()
            presence = {"availability": p.get("availability"), "activity": p.get("activity")}

    return {
        "connected": True,
        "profile": {
            "entra_id": u.get("id"),
            "display_name": u.get("displayName"),
            "email": u.get("mail"),
            "job_title": u.get("jobTitle"),
            "department": u.get("department"),
            "office": u.get("officeLocation"),
            "phone": u.get("mobilePhone"),
        },
        "teams": teams,
        "presence": presence,
    }


async def _noop() -> None:
    return None


async def get_connected_apps_details(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    email: str,
    entra_oid: str | None = None,
) -> dict:
    jira, github, gitlab, teams = await asyncio.gather(
        _jira_details(email),
        _github_details(email),
        _gitlab_details(email),
        _teams_details(db, tenant_id, entra_oid) if entra_oid else _noop(),
    )

    return {
        "jira": jira or {"connected": False},
        "github": github or {"connected": False},
        "gitlab": gitlab or {"connected": False},
        "teams": teams or {"connected": False},
    }
