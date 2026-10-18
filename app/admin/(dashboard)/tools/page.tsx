import { ThankYouCardTool } from "./thank-you-card-tool"

export const metadata = { title: "도구 | VOW SEOUL" }

export default function ToolsPage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">도구</h1>
        <p className="text-sm text-muted-foreground">청첩장 외에 고객에게 함께 만들어 드리는 것들입니다.</p>
      </div>
      <ThankYouCardTool />
    </div>
  )
}
