import { APIManager } from './API/APIManagerState'
import { ChatEntry } from '@lib/state/Chat'
import { APIConfiguration, APIValues } from './API/APIBuilder.types'
import { Logger } from '@lib/state/Logger'
import { AppSettings, Global } from '@lib/constants/GlobalValues'
import { mmkv } from '@lib/storage/MMKV'
import { requestBuilder } from './API/RequestBuilder'
import { SamplersManager } from '@lib/state/SamplerState'
import { Instructs } from '@lib/state/Instructs'
import { Message } from './API/ContextBuilder'

export const generateSummary = async (
    messages: ChatEntry[],
    currentSummary: string,
    prompt: string
): Promise<string> => {
    // 1. Get the Summarization API config
    const apiId = mmkv.getString(AppSettings.SummarizationAPI)
    const { values, getTemplates, activeIndex } = APIManager.useConnectionsStore.getState()

    let apiValue: APIValues | undefined
    let apiConfig: APIConfiguration | undefined

    if (apiId) {
        // Try to find by friendlyName
        const foundValue = values.find(v => v.friendlyName === apiId)
        if (foundValue) {
            apiValue = foundValue
             apiConfig = getTemplates().find((item) => item.name === foundValue.configName)
        }
    }

    if (!apiValue || !apiConfig) {
         Logger.info("Summarization API not set or not found, using active API.")
         const active = values[activeIndex]
         apiValue = active
         apiConfig = getTemplates().find((item) => item.name === active?.configName)
    }

    if (!apiValue || !apiConfig) {
        Logger.errorToast("No API available for summarization")
        return currentSummary
    }

    // 2. Construct Prompt
    let conversationText = ''
    messages.forEach((msg) => {
        const swipe = msg.swipes[msg.swipe_id]
        conversationText += `${msg.name}: ${swipe.swipe}\n`
    })

    const fullPrompt = `${prompt}\n\nExisting Summary:\n${currentSummary}\n\nNew Conversation:\n${conversationText}`

    // 3. Make Request
    const isChat = apiConfig.request.completionType.type === 'chatCompletions'

    let constructedInput: string | Message[] = fullPrompt

    if (isChat) {
         constructedInput = [
             { role: 'user', content: [{ type: 'text', text: fullPrompt }] }
         ]
    }

    // Retrieve samplers but maybe we should override some defaults for summary?
    // Using current samplers might be risky if temperature is high or max tokens low.
    // For now, use current samplers.
    // Use a safe default sampler for summarization to avoid truncation
    // We clone the current sampler but override length
    const currentSamplers = SamplersManager.getCurrentSampler()
    const samplers = {
        ...currentSamplers,
        max_length: 500, // Ensure enough tokens for summary
        genamt: 500,
        // Maybe strict temperature?
        temperature: 0.7
    }

    const instruct = Instructs.useInstruct.getState().data
    if (!instruct) {
        Logger.error("No instruct data found")
        return currentSummary
    }

    const { url, headers, body } = await requestBuilder(
        apiValue,
        apiConfig,
        constructedInput,
        samplers,
        instruct,
        [], // stop sequences, maybe none needed or default
    )

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        })

        if (!response.ok) {
             const err = await response.text()
             Logger.error(`Summarization failed: ${err}`)
             return currentSummary
        }

        const data = await response.json()

        let result = ''
        if (isChat) {
             result = data.choices?.[0]?.message?.content || data.choices?.[0]?.delta?.content || ''
        } else {
             result = data.choices?.[0]?.text || ''
        }

        if (!result && apiConfig.name === 'Horde') {
            result = data.generations?.[0]?.text || ''
        }

        if (apiConfig.name === 'Claude') {
             // Claude usually returns content array or text
             if (data.content && Array.isArray(data.content)) {
                 result = data.content.map((c: any) => c.text).join('')
             } else if (data.content) {
                 result = data.content
             }
        }

        return result.trim()

    } catch (e) {
        Logger.error(`Summarization error: ${e}`)
        return currentSummary
    }
}
