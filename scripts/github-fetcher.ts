const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGithub(url: string, options: any = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            ...(options.headers || {})
        }
    })
    if (!res.ok) throw new Error(`GitHub API failed: ${res.status}`)
    return res.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGraphql(query: string, variables: any = {}) {
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
    })
    if (!res.ok) throw new Error(`GraphQL fetch failed: ${res.status}`)
    return res.json()
}

export async function fetchProductiveTime(username: string) {
    try {
        const events = await fetchGithub(`https://api.github.com/users/${username}/events/public?per_page=100`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pushEvents = events.filter((e: any) => e.type === 'PushEvent')
        
        const timeBuckets = { morning: 0, daytime: 0, evening: 0, night: 0 }
        let totalCommits = 0
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pushEvents.forEach((event: any) => {
            // Use local runtime timezone (Set via TZ env variable in Github Actions)
            const date = new Date(event.created_at)
            const hour = date.getHours()

            if (hour >= 6 && hour < 12) timeBuckets.morning++
            else if (hour >= 12 && hour < 18) timeBuckets.daytime++
            else if (hour >= 18 && hour < 24) timeBuckets.evening++
            else timeBuckets.night++
            totalCommits++
        })
        
        if (totalCommits === 0) {
            return {
                morning: 0, daytime: 0, evening: 0, night: 0,
                commits: { morning: 0, daytime: 0, evening: 0, night: 0 }
            }
        }
        
        return {
            morning: Math.round((timeBuckets.morning / totalCommits) * 100),
            daytime: Math.round((timeBuckets.daytime / totalCommits) * 100),
            evening: Math.round((timeBuckets.evening / totalCommits) * 100),
            night: Math.round((timeBuckets.night / totalCommits) * 100),
            commits: timeBuckets
        }
    } catch (e) {
        console.warn('Failed to fetch productive time:', e)
        return {
            morning: 0, daytime: 0, evening: 0, night: 0,
            commits: { morning: 0, daytime: 0, evening: 0, night: 0 }
        }
    }
}

export async function fetchUserRepositories(username: string) {
    try {
        // 1. Fetch User Node ID to filter commit history
        const userQuery = `query($login: String!) { user(login: $login) { id } }`
        const userRes = await fetchGraphql(userQuery, { login: username })
        const userId = userRes.data?.user?.id
        if (!userId) return []

        // 2. Fetch Repositories with ID
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - 7)
        const sinceIso = sinceDate.toISOString()
        const query = `
            query($login: String!, $userId: ID!, $since: GitTimestamp!) {
                user(login: $login) {
                    repositories(first: 100, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
                        nodes {
                            name
                            pushedAt
                            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                                edges { size node { name } }
                            }
                            defaultBranchRef {
                                target { ... on Commit { history(author: {id: $userId}, since: $since) { totalCount } } }
                            }
                        }
                    }
                }
            }
        `
        const { data } = await fetchGraphql(query, { login: username, userId, since: sinceIso })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data?.user?.repositories?.nodes || []
    } catch (e) {
        console.warn('Failed to fetch repositories:', e)
        return []
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateWeeklyLanguages(repos: any[]) {
    try {
        const langMap = new Map()
        let totalBytes = 0
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const repo of repos) {
            if (!repo.languages?.edges) continue
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const { size, node } of repo.languages.edges) {
                const current = langMap.get(node.name) || { size: 0, count: 0 }
                langMap.set(node.name, { size: current.size + size, count: current.count + 1 })
                totalBytes += size
            }
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = Array.from(langMap.entries()).map(([name, val]: any) => ({
            name,
            count: val.count,
            percent: totalBytes > 0 ? Math.round((val.size / totalBytes) * 100 * 100) / 100 : 0
        }))
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return results.sort((a: any, b: any) => b.percent - a.percent)
    } catch (e) {
        console.warn('Failed to calculate languages:', e)
        return []
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchUserEvents(username: string) {
    try {
        const events: any[] = []
        for (let page = 1; page <= 3; page++) {
            const data = await fetchGithub(`https://api.github.com/users/${username}/events/public?per_page=100&page=${page}`)
            events.push(...data)
            if (data.length < 100) break
        }
        return events
    } catch(e) {
        return []
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateWeeklyProjects(events: any[]) {
    try {
        const projectMap = new Map<string, number>()
        let totalCount = 0
        
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        events.forEach((event: any) => {
            if (!event.created_at || new Date(event.created_at) < sevenDaysAgo) return
            let count = 0
            if (event.type === 'PushEvent') {
                count = event.payload?.commits?.length || event.payload?.size || 1
            } else if (event.type === 'PullRequestEvent') {
                const action = event.payload?.action
                if (action === 'opened' || action === 'closed') count = 1
            } else if (event.type === 'CreateEvent') {
                count = 1
            }
            if (count > 0) {
                const repoName = event.repo?.name?.split('/')[1] || event.repo?.name
                projectMap.set(repoName, (projectMap.get(repoName) || 0) + count)
                totalCount += count
            }
        })
        
        if (totalCount === 0) return []
        
        const results = Array.from(projectMap.entries()).map(([name, count]) => ({
            name,
            commits: count,
            percent: Math.round((count / totalCount) * 100 * 100) / 100
        }))
        
        return results.sort((a, b) => b.commits - a.commits)
    } catch (e) {
        console.warn('Failed to calculate projects:', e)
        return []
    }
}