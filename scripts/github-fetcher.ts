import fs from 'fs'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGithub(url: string) {
    const res = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
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
            const hour = new Date(event.created_at).getHours()
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

        // 2. Fetch Repositories with ID & Filter commits by last 7 days ($since)
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
        
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - 7)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const repo of repos) {
            const pushedAt = new Date(repo.pushedAt)
            if (pushedAt < sinceDate) continue
            
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
export function calculateWeeklyProjects(repos: any[]) {
    try {
        let results: Array<{name: string, commits: number, percent?: number}> = []
        let totalCommits = 0
        
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - 7)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const repo of repos) {
            const pushedAt = new Date(repo.pushedAt)
            if (pushedAt < sinceDate) continue
            
            const commits = repo.defaultBranchRef?.target?.history?.totalCount || 0
            if (commits > 0) {
                results.push({ name: repo.name, commits })
                totalCommits += commits
            }
        }
        
        results = results.map(r => ({
            ...r,
            percent: totalCommits > 0 ? Math.round((r.commits / totalCommits) * 100 * 100) / 100 : 0
        }))
        
        return results.sort((a, b) => b.commits - a.commits)
    } catch (e) {
        console.warn('Failed to calculate projects:', e)
        return []
    }
}
