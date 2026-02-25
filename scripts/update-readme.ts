import * as fs from 'fs'
import * as path from 'path'
import { fetchProductiveTime, fetchWeeklyLanguages, fetchWeeklyProjects } from './github-fetcher'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generateProductiveTimeAscii = (style: string, stats: any) => {
    const { morning, daytime, evening, night, commits } = stats
    const total = commits.morning + commits.daytime + commits.evening + commits.night
    if (total === 0) return '```text\n        [zzz]\n       ( -_-)\n      /|    |\\\\\n     / |    | \\\\\n    ￣￣￣￣￣￣￣\n  Currently taking a coffee break ☕\n  (No public activity found... yet!)\n```\n'

    const row = (icon: string, label: string, count: number, percentage: number, barStyle: string) => {
        let bar = ''
        if (barStyle === 'cyber') bar = createBar(percentage, 25, '█', '░')
        else if (barStyle === 'modern') bar = createBar(percentage, 25, '■', '□')
        else if (barStyle === 'minimal') bar = createBar(percentage, 25, '●', '○')
        else if (barStyle === 'terminal') bar = createBar(percentage, 25, '⣿', '⣀')
        else if (barStyle === 'slider') bar = createSlider(percentage, 25, '─', '●')
        
        const safeCount = (count || 0).toString().padStart(6, ' ')
        const safePercent = (percentage || 0).toFixed(2).padStart(5, '0')
        const iconPad = icon ? `${icon} ` : (barStyle === 'terminal' ? '> ' : '')
        return `${iconPad}${label.padEnd(14, ' ')} ${safeCount} commits    ${bar}    ${safePercent} %`
    }

    let ascii = '```text\n'
    if (style === 'modern') {
        ascii += row('🏙️', 'Morning', commits.morning, morning, style) + '\n' +
        row('🏢', 'Daytime', commits.daytime, daytime, style) + '\n' +
        row('🌉', 'Evening', commits.evening, evening, style) + '\n' +
        row('🌃', 'Night', commits.night, night, style) + '\n'
    } else if (style === 'minimal') {
        ascii += row('🕕', 'Morning', commits.morning, morning, style) + '\n' +
        row('🕛', 'Daytime', commits.daytime, daytime, style) + '\n' +
        row('🕡', 'Evening', commits.evening, evening, style) + '\n' +
        row('🕛', 'Night', commits.night, night, style) + '\n'
    } else if (style === 'terminal') {
        ascii += row('', 'Morning', commits.morning, morning, style) + '\n' +
        row('', 'Daytime', commits.daytime, daytime, style) + '\n' +
        row('', 'Evening', commits.evening, evening, style) + '\n' +
        row('', 'Night', commits.night, night, style) + '\n'
    } else if (style === 'slider') {
        ascii += row('🕐', 'Morning', commits.morning, morning, style) + '\n' +
        row('☀️', 'Daytime', commits.daytime, daytime, style) + '\n' +
        row('🌕', 'Evening', commits.evening, evening, style) + '\n' +
        row('💤', 'Night', commits.night, night, style) + '\n'
    } else {
        ascii += row('🌞', 'Morning', commits.morning, morning, 'cyber') + '\n' +
        row('🌆', 'Daytime', commits.daytime, daytime, 'cyber') + '\n' +
        row('🌃', 'Evening', commits.evening, evening, 'cyber') + '\n' +
        row('🌙', 'Night', commits.night, night, 'cyber') + '\n'
    }
    ascii += '```\n'
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
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
        } catch (e) {
            console.error('❌ Failed to parse config JSON. Stopping execution.')
            process.exit(0)
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
        if (dynamicBlocks.some((b: any) => b.widgetType === 'productive-time')) {
            timeData = await fetchProductiveTime(config.username)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (dynamicBlocks.some((b: any) => b.widgetType === 'weekly-languages')) {
            langData = await fetchWeeklyLanguages(config.username)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (dynamicBlocks.some((b: any) => b.widgetType === 'weekly-projects')) {
            projData = await fetchWeeklyProjects(config.username)
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
                        const title = bConf.title || '💬 Weekly Languages'
                        const lLimit = lConf.count || config.activityStats?.itemCount || 5
                        const excludes = lConf.excludeLanguages || []
                        
                        const sortedLang = [...(langData || [])]
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (lConf.sortBy === 'alphabetical') sortedLang.sort((a: any, b: any) => a.name.localeCompare(b.name))
                        
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const filteredLang = sortedLang.filter((l: any) => !excludes.includes(l.name)).slice(0, lLimit)
                        
                        markdownToInject = '\n```text\n' + title + '\n\n'
                        if (filteredLang.length === 0) {
                            markdownToInject += '>_ Productive Time\n\n' +
                                '   ╭────────────────────────────╮\n' +
                                '   │   NO ACTIVITY DETECTED     │\n' +
                                '   │   Waiting for daily code.  │\n' +
                                '   ╰────────────────────────────╯\n'
                        } else {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            filteredLang.forEach((lang: any) => {
                                const bar = generateProgressBar(lang.percent, 25)
                                markdownToInject += `${lang.name.padEnd(15, ' ')} ${(lang.count + ' Repos').padEnd(15, ' ')} ${bar} ${lang.percent.toString().padStart(7, ' ')} %\n`
                            })
                        }
                        markdownToInject += '```\n'
                        break
                        
                    case 'weekly-projects':
                        const pConf = bConf.weeklyProjects || config.weeklyProjects || {}
                        const pTitle = bConf.title || '🐱💻 Weekly Projects'
                        const pLimit = pConf.count || config.activityStats?.itemCount || 5
                        
                        const sortedProj = [...(projData || [])]
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (pConf.sortBy === 'alphabetical') sortedProj.sort((a: any, b: any) => a.name.localeCompare(b.name))
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        else if (pConf.sortBy === 'commits') sortedProj.sort((a: any, b: any) => b.commits - a.commits)
                        
                        const finalProj = sortedProj.slice(0, pLimit)
                        
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
                                const bar = generateProgressBar(proj.percent, 25)
                                markdownToInject += `${proj.name.padEnd(20, ' ')} ${(proj.commits + ' commits').padEnd(15, ' ')} ${bar} ${proj.percent.toString().padStart(7, ' ')} %\n`
                            })
                        }
                        markdownToInject += '```\n'
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