// Isolated contract fixture: real shared controls, no Runtime or maintenance calls.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Input, Checkbox, Select, Field, Button } from "../../apps/desktop/src/components/Controls";
import { Drawer, Tabs } from "../../apps/desktop/src/components/UI";
import { Disclosure, Menu } from "../../apps/desktop/src/components/Surfaces";
import "../../apps/desktop/src/styles/style.css";
function Fixture() {
  const [number, setNumber] = useState("2"), [password, setPassword] = useState(""), [date, setDate] = useState(""), [choice, setChoice] = useState(""), [checked, setChecked] = useState(false), [tab, setTab] = useState("概览"), [drawer, setDrawer] = useState(false), [result, setResult] = useState(""), [realEvent, setRealEvent] = useState(false);
  const select = <Field>选项<Select value={choice} onValueChange={setChoice} required><option value="">默认值</option><option value="disabled" disabled>不可选</option><option value="one">第一项</option><option value="two">第二项</option></Select></Field>;
  return <main className="content-page">
    <form onSubmit={(event) => { event.preventDefault(); setResult(JSON.stringify({ number: Number(number), password, date, choice, checked, realEvent })); }}>
      <Field>数量<Input type="number" min={1} max={8} required value={number} onChange={(event) => { setNumber(event.target.value); setRealEvent(event.nativeEvent instanceof Event); }} /></Field>
      <Field>口令<Input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
      <Field>日期<Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      {select}
      <Field><Checkbox checked={checked} onCheckedChange={setChecked} />保存后启用</Field>
      <Button type="submit">保存</Button>
    </form>
    <output aria-label="保存结果">{result}</output>
    <Tabs items={["概览", "设定", "记忆"]} value={tab} onChange={setTab} label="中文分类"><p>{tab}内容</p></Tabs>
    <Button onClick={() => setDrawer(true)}>打开抽屉</Button>
    {drawer && <Drawer title="控件抽屉" close={() => setDrawer(false)}>
      <Disclosure title="隐藏字段"><Input aria-label="折叠输入" /></Disclosure>
      <div style={{ height: 300 }}>滚动区域</div>
      {select}
      <Menu trigger={<Button>声音选项</Button>}><Field>声音<Input value={password} onChange={(event) => setPassword(event.target.value)} /></Field></Menu>
    </Drawer>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
