import ThemedSwitch from '@components/input/ThemedSwitch'
import SectionTitle from '@components/text/SectionTitle'
import { AppSettings } from '@lib/constants/GlobalValues'
import React from 'react'
import { View } from 'react-native'
import { useMMKVBoolean, useMMKVString, useMMKVNumber } from 'react-native-mmkv'
import ThemedTextInput from '@components/input/ThemedTextInput'
import ThemedDropdown from '@components/input/ThemedDropdown'
import { APIManager } from '@lib/engine/API/APIManagerState'

const SummarizationSettings = () => {
    const [summarizationApi, setSummarizationApi] = useMMKVString(AppSettings.SummarizationAPI)
    const [summaryPrompt, setSummaryPrompt] = useMMKVString(AppSettings.SummaryPrompt)
    const [maxConversationLength, setMaxConversationLength] = useMMKVNumber(AppSettings.MaxConversationLength)

    const apis = APIManager.useConnectionsStore((state) => state.values)
    const apiOptions = apis.map(api => ({ label: api.friendlyName, value: api.friendlyName }))

    // Add "Disabled" or "Active API" option?
    const options = [{ label: 'Use Active API', value: '' }, ...apiOptions]

    return (
        <View style={{ rowGap: 8 }}>
            <SectionTitle>Summarization</SectionTitle>

            <ThemedDropdown
                label="Summarization API"
                data={options}
                value={summarizationApi || ''}
                onChangeValue={(val) => setSummarizationApi(val)}
                description="Select the API to use for summarizing conversations"
            />

            <ThemedTextInput
                label="Summary Prompt"
                value={summaryPrompt}
                onChangeText={setSummaryPrompt}
                description="Prompt used for summarization"
                multiline
            />

            <ThemedTextInput
                label="Max Messages"
                value={maxConversationLength?.toString()}
                onChangeText={(val) => setMaxConversationLength(parseInt(val) || 0)}
                description="Auto-summarize after this many messages (0 to disable)"
                keyboardType="numeric"
            />
        </View>
    )
}

export default SummarizationSettings
