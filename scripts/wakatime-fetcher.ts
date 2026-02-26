const WAKATIME_API_KEY = process.env.WAKATIME_API_KEY || ''

export async function fetchWakatimeStats() {
    try {
        if (!WAKATIME_API_KEY) throw new Error('WAKATIME_API_KEY is not defined')
        const encodedKey = Buffer.from(WAKATIME_API_KEY).toString('base64')
        const ranges = ['all_time', 'last_year', 'last_7_days']
        let finalData: any = null
        let finalRange = 'unknown'

        for (const range of ranges) {
            const response = await fetch(`https://wakatime.com/api/v1/users/current/stats/${range}`, {
                headers: { 'Authorization': `Basic ${encodedKey}` }
            })
            if (response.status === 202) {
                continue
            }
            if (response.ok) {
                const data = await response.json()
                const langs = data.data?.languages || []
                if (langs.length > 0) {
                    finalData = data
                    finalRange = range
                    break
                }
            }
        }

        let languages = finalData?.data?.languages || []
        const isIncludingToday = finalData?.data?.is_including_today ?? false

        if (!isIncludingToday) {
            try {
                const todayStr = new Date().toISOString().split('T')[0]
                const summariesResponse = await fetch(`https://wakatime.com/api/v1/users/current/summaries?start=${todayStr}&end=${todayStr}`, {
                    headers: { 'Authorization': `Basic ${encodedKey}` }
                })
                if (summariesResponse.ok) {
                    const todayData = await summariesResponse.json()
                    const todayLangs = todayData.data?.[0]?.languages || []
                    if (todayLangs.length > 0) {
                        const mergedLangsMap = new Map()
                        for (const lang of languages) {
                            mergedLangsMap.set(lang.name, { ...lang, total_seconds: lang.total_seconds })
                        }
                        for (const todayLang of todayLangs) {
                            if (mergedLangsMap.has(todayLang.name)) {
                                mergedLangsMap.get(todayLang.name).total_seconds += todayLang.total_seconds
                            } else {
                                mergedLangsMap.set(todayLang.name, { name: todayLang.name, total_seconds: todayLang.total_seconds })
                            }
                        }
                        languages = Array.from(mergedLangsMap.values()).sort((a, b) => b.total_seconds - a.total_seconds)
                    }
                }
            } catch (mergeError) {
                console.error('Failed to merge today summary:', mergeError)
            }
        }

        return {
            success: true,
            isCalculating: finalRange === 'unknown',
            timeRange: finalRange === 'unknown' ? 'today' : finalRange,
            languages
        }
    } catch (e: any) {
        console.error('WakaTime Fetcher Error:', e.message)
        return { success: false, languages: [] }
    }
}
