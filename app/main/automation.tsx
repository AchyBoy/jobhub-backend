//JobHub/app/main/automation.tsx
import {
View,
Text,
StyleSheet,
ScrollView,
Pressable,
TextInput
} from 'react-native'

import { useEffect,useState } from 'react'
import { apiFetch } from '../../src/lib/apiClient'
import AsyncStorage from '@react-native-async-storage/async-storage'

type TemplateNote = {
id:string
phase:string
noteA:string
noteB?:string
}

export default function AutomationScreen(){

const [automations,setAutomations] = useState<any[]>([])
const [templateNotes,setTemplateNotes] = useState<TemplateNote[]>([])

const [noteSearch,setNoteSearch] = useState('')
const [selectedNote,setSelectedNote] = useState<TemplateNote|null>(null)

const [actionType,setActionType] = useState('schedule_task')
const [scheduleOffset,setScheduleOffset] = useState('7_days_after')

async function loadAutomations(){
try{
const res = await apiFetch('/api/automations')
setAutomations(res.automations ?? [])
}catch{}
}

async function loadTemplateNotes(){

try{

const cached = await AsyncStorage.getItem('template_notes_v1')

if(cached){
setTemplateNotes(JSON.parse(cached))
}

const res = await apiFetch('/api/templates/notes')

if(res?.notes){

setTemplateNotes(res.notes)

await AsyncStorage.setItem(
'template_notes_v1',
JSON.stringify(res.notes)
)

}

}catch{}
}

async function createAutomation(){

if(!selectedNote) return

try{

const res = await apiFetch('/api/automations',{
method:'POST',
body:JSON.stringify({
triggerType:'note_incomplete',
triggerNote:selectedNote.noteA,
actionPhase:selectedNote.phase,
scheduleOffset
})
})

setAutomations(prev=>[res.automation,...prev])

setSelectedNote(null)
setNoteSearch('')
setScheduleOffset('7_days_after')

}catch(err){
console.log('automation create failed',err)
}

}

const filteredNotes = templateNotes.filter(n=>{

const q = noteSearch.toLowerCase()

return (
n.noteA?.toLowerCase().includes(q) ||
n.noteB?.toLowerCase().includes(q) ||
n.phase?.toLowerCase().includes(q)
)

}).slice(0,8)

useEffect(()=>{
loadAutomations()
loadTemplateNotes()
},[])

return(

<ScrollView
style={styles.container}
contentContainerStyle={{paddingBottom:40}}
>

<Text style={styles.title}>Automation Rules</Text>

<View style={styles.card}>

<Text style={styles.label}>Trigger Note</Text>

<View style={styles.searchWrap}>
  <TextInput
    value={noteSearch}
    onChangeText={setNoteSearch}
    placeholder="Search note..."
    style={styles.input}
  />

  {noteSearch.length > 0 && selectedNote === null && (
    <View style={styles.results}>
      {filteredNotes.length === 0 ? (
        <View style={styles.resultRow}>
          <Text style={styles.noteSub}>No matching notes found</Text>
        </View>
      ) : (
        filteredNotes.map(n => (
          <Pressable
            key={n.id}
            style={styles.resultRow}
            onPress={() => {
              setSelectedNote(n)
              setNoteSearch(`${n.noteA}`)
            }}
          >
            <Text style={styles.noteTitle}>
              {n.noteA}
            </Text>

            {n.noteB && (
              <Text style={styles.noteSub}>
                {n.noteB}
              </Text>
            )}

            <Text style={styles.notePhase}>
              Phase: {n.phase}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  )}
</View>

{selectedNote && (

<View style={styles.selectedBox}>

<Text style={styles.noteTitle}>
{selectedNote.noteA}
</Text>

{selectedNote.noteB && (
<Text style={styles.noteSub}>
{selectedNote.noteB}
</Text>
)}

<Text style={styles.notePhase}>
Phase: {selectedNote.phase}
</Text>

</View>

)}

<Text style={styles.label}>Action</Text>

<View style={styles.actionRow}>

<Pressable
style={[
styles.actionPill,
actionType==='schedule_task' && styles.actionSelected
]}
onPress={()=>setActionType('schedule_task')}
>
<Text
style={[
styles.actionText,
actionType==='schedule_task' && styles.actionTextSelected
]}
>
Schedule Task
</Text>
</Pressable>

</View>

<Text style={styles.label}>Offset</Text>

<View style={styles.offsetRow}>

{[
['same_day','Same Day'],
['3_days_before','3 Days Before'],
['7_days_after','7 Days After']
].map(([value,label])=>{

const selected = scheduleOffset===value

return(

<Pressable
key={value}
style={[
styles.offsetPill,
selected && styles.offsetSelected
]}
onPress={()=>setScheduleOffset(value)}
>

<Text
style={[
styles.offsetText,
selected && styles.offsetTextSelected
]}
>
{label}
</Text>

</Pressable>

)

})}

</View>

<Pressable
style={styles.createBtn}
onPress={createAutomation}
>
<Text style={styles.createText}>
Create Automation
</Text>
</Pressable>

</View>

<Text style={styles.sectionHeader}>
Existing Automations
</Text>

{automations.map(a=>(
<View key={a.id} style={styles.ruleCard}>

<Text style={styles.ruleLabel}>Trigger</Text>
<Text>When "{a.trigger_note}" becomes incomplete</Text>

<Text style={styles.ruleLabel}>Action</Text>
<Text>Schedule "{a.action_phase}"</Text>

<Text style={styles.ruleLabel}>Offset</Text>
<Text>{a.schedule_offset}</Text>

</View>
))}

</ScrollView>

)
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:'#fff',
padding:20,
paddingTop:60
},

title:{
fontSize:26,
fontWeight:'700',
marginBottom:20
},

sectionHeader:{
marginTop:28,
marginBottom:12,
fontWeight:'700'
},

card:{
backgroundColor:'#f3f4f6',
padding:16,
borderRadius:16,
zIndex:10
},

searchWrap:{
position:'relative',
zIndex:100,
marginTop:6
},

input:{
borderWidth:1,
borderColor:'#e2e8f0',
borderRadius:10,
padding:10,
backgroundColor:'#fff'
},

results:{
position:'absolute',
top:52,
left:0,
right:0,
backgroundColor:'#fff',
borderRadius:12,
borderWidth:1,
borderColor:'#e2e8f0',
zIndex:999,
elevation:20,
maxHeight:260,
overflow:'hidden'
},

resultRow:{
padding:12,
borderBottomWidth:1,
borderBottomColor:'#e5e7eb'
},

selectedBox:{
marginTop:10,
padding:12,
backgroundColor:'#eef2ff',
borderRadius:12
},

noteTitle:{
fontWeight:'700'
},

noteSub:{
fontSize:12,
opacity:0.7
},

notePhase:{
fontSize:11,
marginTop:2,
opacity:0.6
},

label:{
marginTop:14,
fontWeight:'700'
},

actionRow:{
flexDirection:'row',
gap:8,
marginTop:8
},

actionPill:{
paddingVertical:6,
paddingHorizontal:10,
borderRadius:999,
backgroundColor:'#e2e8f0'
},

actionSelected:{
backgroundColor:'#2563eb'
},

actionText:{fontSize:12},

actionTextSelected:{
color:'#fff'
},

offsetRow:{
flexDirection:'row',
flexWrap:'wrap',
gap:8,
marginTop:10
},

offsetPill:{
paddingVertical:6,
paddingHorizontal:10,
borderRadius:999,
backgroundColor:'#e2e8f0'
},

offsetSelected:{
backgroundColor:'#2563eb'
},

offsetText:{fontSize:12},

offsetTextSelected:{color:'#fff'},

createBtn:{
marginTop:16,
backgroundColor:'#2563eb',
padding:12,
borderRadius:10
},

createText:{
color:'#fff',
fontWeight:'700',
textAlign:'center'
},

ruleCard:{
backgroundColor:'#f8fafc',
padding:16,
borderRadius:14,
marginBottom:12
},

ruleLabel:{
marginTop:8,
fontWeight:'700'
}

})