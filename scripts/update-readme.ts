import * as fs from 'fs'
import * as path from 'path'
import { fetchProductiveTime, fetchUserRepositories, calculateWeeklyLanguages, calculateWeeklyProjects } from './github-fetcher'
import { fetchWakatimeStats } from './wakatime-fetcher'

const README_PATH = path.join(process.cwd(), 'README.md')
const CONFIG_PATH = path.join(process.cwd(), 'glossy-config.json')

const createBar = (percentage: number, length: number = 25, fillChar: string = '█', emptyChar: string = '░'): string => {
    const safePercentage = Math.max(0, Math.min(100, percentage))
    const filledLength = Math.round((safePercentage / 100) * length)
    return fillChar.repeat(filledLength) + emptyChar.repeat(length - filledLength)
}

const createSlider = (percentage: number, length: number = 25, lineChar: string = '─', thumbChar: string = '●'): string => {
    const safePercentage = Math.max(0, Math.min(100, percentage))
    const position = Math.round((safePercentage / 100) * (length - 1))
    const before = lineChar.repeat(position)
    const after = lineChar.repeat(Math.max(0, length - 1 - position))
    return before + thumbChar + after
}

const generateProgressBar = createBar;

const THEME_COLORS = [
    { id: 'blue', emoji: { square: '🟦', circle: '🔵' } },
    { id: 'green', emoji: { square: '🟩', circle: '🟢' } },
    { id: 'purple', emoji: { square: '🟪', circle: '🟣' } },
    { id: 'orange', emoji: { square: '🟧', circle: '🟠' } },
    { id: 'red', emoji: { square: '🟥', circle: '🔴' } }
]

const generateEmojiBar = (percent: number, filledEmoji: string = '🟦', size: number = 10) => {
    const safePercentage = Math.max(0, Math.min(100, percent))
    const filled = Math.round((size * safePercentage) / 100)
    const empty = size - filled
    return filledEmoji.repeat(filled) + '⬜'.repeat(empty)
}

const generateCompactBadge = (colorEmoji: string = '🔵') => {
    return colorEmoji
}

const ProductiveTimeTitles = {
    morning: '🌞 Morning Bird',
    daytime: '☀️ Daytime Hustler',
    evening: '🌆 Evening Contributor',
    night: '🦉 Night Owl',
    flexible: '🌌 Unpredictable Genius'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getDynamicTitle = (style: string, stats: any): string => {
    const { morning, daytime, evening, night } = stats.commits
    const max = Math.max(morning, daytime, evening, night)
    let title = ''
    if (max === morning) title = ProductiveTimeTitles.morning
    else if (max === daytime) title = ProductiveTimeTitles.daytime
    else if (max === evening) title = ProductiveTimeTitles.evening
    else if (max === night) title = ProductiveTimeTitles.night
    else title = ProductiveTimeTitles.flexible

    return style === 'terminal' ? `>_ ${title}` : title
}

const generateCyberDeckAscii = (stats: any) => {
    const { morning, daytime, evening, night, commits } = stats
    const row = (icon: string, label: string, count: number, percentage: number) => {
        const bar = createBar(percentage, 25, '█', '░')
        return `${icon} ${label.padEnd(14, ' ')} ${count.toString().padStart(6, ' ')} commits    ${bar}    ${percentage.toFixed(2).padStart(5, '0')} %`
    }
    return '```text\n' +
        row('🌞', 'Morning', commits.morning, morning) + '\n' +
        row('🌆', 'Daytime', commits.daytime, daytime) + '\n' +
        row('🌃', 'Evening', commits.evening, evening) + '\n' +
        row('🌙', 'Night', commits.night, night) + '\n' +
        '```\n'
}
const generateModernSquareAscii = (stats: any) => {
    const { morning, daytime, evening, night, commits } = stats
    const row = (icon: string, label: string, count: number, percentage: number) => {
        const bar = createBar(percentage, 25, '■', '□')
        return `${icon} ${label.toUpperCase().padEnd(14, ' ')} ${count.toString().padStart(6, ' ')} commits     ${bar}    ${percentage.toFixed(2).padStart(5, '0')} %`
    }
    return '```text\n' +
        row('🏙️', 'Morning', commits.morning, morning) + '\n' +
        row('🏢', 'Daytime', commits.daytime, daytime) + '\n' +
        row('🌉', 'Evening', commits.evening, evening) + '\n' +
        row('🌃', 'Night', commits.night, night) + '\n' +
        '```\n'
}
const generateMinimalDotAscii = (stats: any) => {
    const { morning, daytime, evening, night, commits } = stats
    const row = (icon: string, label: string, count: number, percentage: number) => {
        const bar = createBar(percentage, 25, '●', '○')
        return `${icon} ${label.padEnd(14, ' ')} ${count.toString().padStart(6, ' ')} commits     ${bar}    ${percentage.toFixed(2).padStart(5, '0')} %`
    }
    return '```text\n' +
        row('🕕', 'Morning', commits.morning, morning) + '\n' +
        row('🕛', 'Daytime', commits.daytime, daytime) + '\n' +
        row('🕡', 'Evening', commits.evening, evening) + '\n' +
        row('🕛', 'Night', commits.night, night) + '\n' +
        '```\n'
}
const generateTerminalAscii = (stats: any) => {
    const { morning, daytime, evening, night, commits } = stats
    const row = (label: string, count: number, percentage: number) => {
        const bar = createBar(percentage, 25, '⣿', '⣀')
        return `> ${label.padEnd(15, ' ')} ${count.toString().padStart(6, ' ')} commits     ${bar}    ${percentage.toFixed(2).padStart(5, '0')} %`
    }
    return '```text\n' +
        row('Morning', commits.morning, morning) + '\n' +
        row('Daytime', commits.daytime, daytime) + '\n' +
        row('Evening', commits.evening, evening) + '\n' +
        row('Night', commits.night, night) + '\n' +
        '```\n'
}
const generateSliderAscii = (stats: any) => {
    const { morning, daytime, evening, night, commits } = stats
    const row = (icon: string, label: string, count: number, percentage: number) => {
        const bar = createSlider(percentage, 25, '─', '●')
        return `${icon} ${label.padEnd(14, ' ')} ${count.toString().padStart(6, ' ')} commits     ${bar}    ${percentage.toFixed(2).padStart(5, '0')} %`
    }
    return '```text\n' +
        row('🕐', 'Morning', commits.morning, morning) + '\n' +
        row('☀️', 'Daytime', commits.daytime, daytime) + '\n' +
        row('🌕', 'Evening', commits.evening, evening) + '\n' +
        row('💤', 'Night', commits.night, night) + '\n' +
        '```\n'
}

function LIMIT_LENGTH(len: number) { return len > 0 ? len : 0 }
const generateWaka10kHoursAscii = (wakaData: any, bConf: any, config: any) => {
    const theme = bConf.theme || 'classic'
    const targetLanguage = bConf.targetLanguage || 'TypeScript'
    const goalTitle = bConf.goalTitle || `Master of ${targetLanguage}`
    const displayMode = bConf.displayMode || 'accumulated'

    const targetLangData = wakaData?.languages?.find((l: any) => l.name === targetLanguage)
    
    let stateMessage = ''
    if (wakaData?.isCalculating) {
        stateMessage = 'WakaTime is currently calculating your all-time stats for the first time. Please check back in a few minutes.'
    } else if (wakaData?.success === false) {
        stateMessage = 'Failed to fetch WakaTime stats.'
    }

    const totalSeconds = (!stateMessage && targetLangData) ? targetLangData.total_seconds || 0 : 0
    const totalHours = Number((totalSeconds / 3600).toFixed(1))
    
    const goalHours = 10000
    let pctNumber = (totalHours / goalHours) * 100
    if (pctNumber > 100) pctNumber = 100
    const percentage = pctNumber.toFixed(2)
    const remainingHours = Number(Math.max(0, goalHours - totalHours).toFixed(1))
    const level = Math.floor(totalHours / 100) + 1

    let markdown = '```text\n'
    markdown += `${goalTitle}\n\n`

    if (stateMessage) {
        if (theme === 'classic') {
            markdown += `${targetLanguage} Proficiency\n`
            markdown += `[ SYSTEM STATUS ]\n`
            markdown += `> ${stateMessage}\n`
        } else if (theme === 'rpg') {
            markdown += `> ⚔️  [CLASS: ${targetLanguage} Artisan]\n`
            markdown += `> ⏳ SYSTEM ALERTS:\n`
            markdown += `>    ${stateMessage}\n`
        } else if (theme === 'terminal') {
            markdown += `guest@github:~$ wakatime --lang "${targetLanguage}" \n`
            markdown += `> WARN: ${stateMessage}\n`
        } else if (theme === 'minimal') {
            markdown += `LANGUAGE     LOGGED TIME         PROGRESS\n`
            markdown += `${targetLanguage.padEnd(12, ' ')} [ ${stateMessage} ]\n`
        }
    } else if (theme === 'classic') {
        const chartBlocks = Math.floor(pctNumber / 5)
        const filled = '█'.repeat(chartBlocks)
        const empty = '░'.repeat(20 - chartBlocks)
        if (displayMode === 'accumulated') {
            markdown += `Total: ${totalHours.toLocaleString()} Hours\n`
        } else {
            markdown += `${remainingHours.toLocaleString()} Hours to mastery\n`
        }
        markdown += `[${filled}${empty}] ${percentage}%\n`
    } else if (theme === 'rpg') {
        const chartBlocks = Math.floor(pctNumber / 5)
        const filled = '▓'.repeat(chartBlocks)
        const empty = '┈'.repeat(LIMIT_LENGTH(20 - chartBlocks))
        markdown += `> ⚔️  [CLASS: ${targetLanguage} Artisan]\n`
        if (displayMode === 'accumulated') {
            markdown += `> 📊 EXP: ${totalHours.toLocaleString()} / 10,000 (Lv. ${level})\n`
        } else {
            markdown += `> 🎯 REMAINING: ${remainingHours.toLocaleString()} Hours to mastery\n`
        }
        markdown += `> 📈 [${filled}${empty}]\n`
    } else if (theme === 'terminal') {
        const filledTotal = Math.floor(pctNumber / 4)
        const fillCount = LIMIT_LENGTH(filledTotal > 0 ? filledTotal - 1 : 0)
        const filled = '='.repeat(fillCount) + (filledTotal > 0 ? '>' : '')
        const empty = ' '.repeat(LIMIT_LENGTH(25 - filledTotal))
        markdown += `guest@github:~$ wakatime --lang "${targetLanguage}" \n`
        markdown += `[${filled}${empty}] ${percentage}%\n`
        markdown += `> ${totalHours.toLocaleString()} hours logged.\n`
        markdown += `> ${displayMode === 'accumulated' ? 'Ongoing progress...' : `${remainingHours.toLocaleString()} hours remaining.`}\n`
    } else if (theme === 'minimal') {
        const chartBlocks = Math.floor(pctNumber / 10)
        const filled = '█'.repeat(chartBlocks)
        const empty = '░'.repeat(10 - chartBlocks)
        const namePad = targetLanguage.padEnd(12, ' ')
        const hoursPad = (displayMode === 'accumulated' ? `${totalHours.toLocaleString()} hrs` : `${remainingHours.toLocaleString()} hrs`).padStart(14, ' ')
        const barPad = `${filled}${empty} (${percentage}%)`.padStart(18, ' ')
        const headerTime = displayMode === 'accumulated' ? 'LOGGED TIME   ' : 'REMAINING TIME'
        markdown += `LANGUAGE     ${headerTime}      PROGRESS\n`
        markdown += `${namePad} ${hoursPad}   ${barPad}\n`
    }
    markdown += '```\n'
    return markdown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generateProductiveTimeAscii = (style: string, stats: any) => {
    const { commits } = stats
    const total = commits.morning + commits.daytime + commits.evening + commits.night
    if (total === 0) return '```text\n        [zzz]\n       ( -_-)\n      /|    |\\\\\n     / |    | \\\\\n    ￣￣￣￣￣￣￣\n  Currently taking a coffee break ☕\n  (No public activity found... yet!)\n```\n'

    let ascii = ''
    if (style === 'modern') ascii = generateModernSquareAscii(stats)
    else if (style === 'minimal') ascii = generateMinimalDotAscii(stats)
    else if (style === 'terminal') ascii = generateTerminalAscii(stats)
    else if (style === 'slider') ascii = generateSliderAscii(stats)
    else ascii = generateCyberDeckAscii(stats)
    
    return getDynamicTitle(style, stats) + '\n' + ascii
}

async function updateReadme() {
    try {
        console.log('📖 Reading existing README.md...')
        const readmeContent = fs.readFileSync(README_PATH, 'utf-8')
        
        console.log('⚙️ Loading glossy-config.json...')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let config: any;
        try {
            const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
            const cleanContent = fileContent.replace(/^\s*\/\/.*$/gm, '')
            config = JSON.parse(cleanContent)
        } catch (e: any) {
            console.error('❌ Failed to read or parse config JSON. Please make sure glossy-config.json exists in the root directory.')
            console.error('Error details:', e.message)
            process.exit(1)
        }
        
        let newReadme = readmeContent
        const blocks = config.blocks || []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dynamicBlocks = blocks.filter((b: any) => b.type === 'widget')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let timeData: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let langData: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let projData: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let wakaData: any = null;
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (dynamicBlocks.some((b: any) => b.widgetType === 'productive-time')) {
            timeData = await fetchProductiveTime(config.username)
        }
        const needsRepos = dynamicBlocks.some((b: any) => ['weekly-languages', 'weekly-projects'].includes(b.widgetType))
        let rawRepos: any = []
        if (needsRepos) {
            rawRepos = await fetchUserRepositories(config.username)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (dynamicBlocks.some((b: any) => b.widgetType === 'weekly-languages')) {
            langData = calculateWeeklyLanguages(rawRepos)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (dynamicBlocks.some((b: any) => b.widgetType === 'weekly-projects')) {
            projData = calculateWeeklyProjects(rawRepos)
        }
        if (dynamicBlocks.some((b: any) => b.widgetType === 'waka-10k-hours')) {
            wakaData = await fetchWakatimeStats()
        }

        for (const block of dynamicBlocks) {
            console.log(`🔄 Updating widget: ${block.widgetType} (ID: ${block.id})`)
            
            const startMarker = `<!-- glossy-${block.widgetType}-${block.id}-start -->`
            const endMarker = `<!-- glossy-${block.widgetType}-${block.id}-end -->`
            
            const startIndex = newReadme.indexOf(startMarker)
            const endIndex = newReadme.indexOf(endMarker)

            if (startIndex !== -1 && endIndex !== -1) {
                let markdownToInject = ''
                const bConf = block.config || {}
                
                switch(block.widgetType) {
                    case 'productive-time':
                        const style = bConf.productiveTime?.style || config.productiveTime?.style || 'cyber'
                        markdownToInject = '\n' + generateProductiveTimeAscii(style, timeData)
                        break
                        
                    case 'weekly-languages':
                        const lConf = bConf.weeklyLanguages || config.weeklyLanguages || {}
                        const title = bConf.title || `💬 Weekly Languages`
                        const lLimit = lConf.count || config.activityStats?.itemCount || 5
                        const excludes = lConf.excludeLanguages || []
                        
                        const sortedLang = [...(langData || [])]
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (lConf.sortBy === 'alphabetical') sortedLang.sort((a: any, b: any) => a.name.localeCompare(b.name))
                        
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const filteredLang = sortedLang.filter((l: any) => !excludes.includes(l.name)).slice(0, lLimit)
                        const visualizationStyle = lConf.style || 'progress'
                        const themeColor = lConf.themeColor || 'blue'
                        const emojis = THEME_COLORS.find(c => c.id === themeColor)?.emoji || THEME_COLORS[0].emoji
                        
                        markdownToInject = '\n```text\n' + title + '\n\n'
                        if (filteredLang.length === 0) {
                            markdownToInject += '   ╭────────────────────────────╮\n' +
                                '   │   NO ACTIVITY DETECTED     │\n' +
                                '   │   Waiting for daily code.  │\n' +
                                '   ╰────────────────────────────╯\n'
                        } else {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            filteredLang.forEach((lang: any) => {
                                let bar = ''
                                if (visualizationStyle === 'progress') bar = generateProgressBar(lang.percent, 25)
                                else if (visualizationStyle === 'emoji') bar = generateEmojiBar(lang.percent, emojis.square, 10)
                                else if (visualizationStyle === 'compact') bar = generateCompactBadge(emojis.circle)
                                
                                const namePad = lang.name.padEnd(15, ' ')
                                const statPad = `${lang.count} Repos`.padEnd(15, ' ')
                                const percentPad = `${lang.percent} %`.padStart(7, ' ')
                                markdownToInject += `${namePad} ${statPad} ${bar} ${percentPad}\n`
                            })
                        }
                        markdownToInject += '```\n'
                        break
                        
                    case 'weekly-projects':
                        const pConf = bConf.weeklyProjects || config.weeklyProjects || {}
                        const pTitle = bConf.title || `🐱💻 Weekly Projects`
                        const pLimit = pConf.count || config.activityStats?.itemCount || 5
                        
                        const sortedProj = [...(projData || [])]
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (pConf.sortBy === 'alphabetical') sortedProj.sort((a: any, b: any) => a.name.localeCompare(b.name))
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        else if (pConf.sortBy === 'commits') sortedProj.sort((a: any, b: any) => b.commits - a.commits)
                        
                        const finalProj = sortedProj.slice(0, pLimit)
                        const pVisualizationStyle = pConf.style || 'progress'
                        const pThemeColor = pConf.themeColor || 'green'
                        const pEmojis = THEME_COLORS.find(c => c.id === pThemeColor)?.emoji || THEME_COLORS[1].emoji
                        
                        markdownToInject = '\n```text\n' + pTitle + '\n\n'
                        if (finalProj.length === 0) {
                            markdownToInject += '     .-.\n' +
                                '   (o o) boo!\n' +
                                '   | O \\\\\n' +
                                '    \\\\   \\\\\n' +
                                '     \'~~~\'\n' +
                                '  Invisible on the radar! 👻\n' +
                                '  (Or maybe just working in private repos...)\n'
                        } else {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            finalProj.forEach((proj: any) => {
                                let bar = ''
                                if (pVisualizationStyle === 'progress') bar = generateProgressBar(proj.percent, 25)
                                else if (pVisualizationStyle === 'emoji') bar = generateEmojiBar(proj.percent, pEmojis.square, 10)
                                else if (pVisualizationStyle === 'compact') bar = generateCompactBadge(pEmojis.circle)
                                
                                const namePad = proj.name.padEnd(20, ' ')
                                const statPad = `${proj.commits} commits`.padEnd(15, ' ')
                                const percentPad = `${proj.percent} %`.padStart(7, ' ')
                                markdownToInject += `${namePad} ${statPad} ${bar} ${percentPad}\n`
                            })
                        }
                        markdownToInject += '```\n'
                        break
                    case 'waka-10k-hours':
                        markdownToInject = '\n' + generateWaka10kHoursAscii(wakaData, bConf, config)
                        break
                }

                newReadme = newReadme.substring(0, startIndex + startMarker.length) +
                    markdownToInject.trimEnd() + '\n' +
                    newReadme.substring(endIndex)
            } else {
                console.warn(`⚠️ Markers not found for widget: ${block.widgetType}`)
            }
        }

        fs.writeFileSync(README_PATH, newReadme, 'utf-8')
        console.log('✅ README updated successfully!')
    } catch (error) {
        console.error('❌ Failed to update README:', error)
        process.exit(1)
    }
}

updateReadme()