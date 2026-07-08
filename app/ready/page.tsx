import Link from "next/link"
import { Globe, ArrowRight } from "lucide-react"

export default function ReadyPage() {
  return (
    <div className="min-h-screen bg-[#FDFBF9] text-[#4A4A4A] flex flex-col items-center justify-center p-6 font-serif relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#F5EBE6] blur-[120px] opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#EAE3FC] blur-[120px] opacity-40 pointer-events-none" />

      <div className="z-10 max-w-md w-full text-center space-y-8 bg-white/40 backdrop-blur-md p-10 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
        {/* Logo/Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#F2ECE7] flex items-center justify-center text-[#9E8B7E] shadow-sm">
            <Globe className="w-8 h-8" />
          </div>
        </div>

        {/* Text Contents */}
        <div className="space-y-4">
          <h1 className="text-3xl font-light tracking-wide text-[#333333]">
            VOW SEOUL
          </h1>
          <div className="w-8 h-[1px] bg-[#9E8B7E] mx-auto my-4" />
          <h2 className="text-xl font-medium text-[#7D6B5F] tracking-tight">
            해당 페이지는 준비중입니다
          </h2>
          <p className="text-sm text-[#8E837B] leading-relaxed font-sans font-light">
            VOW SEOUL의 프리미엄 청첩장 제작 기능 오픈을 앞두고 있습니다.<br />
            보다 품격있고 완벽한 모습으로 곧 찾아뵙겠습니다.
          </p>
        </div>

        {/* Admin Login Link */}
        <div className="pt-4 font-sans text-[11px]">
          <Link 
            href="/admin/login" 
            className="inline-flex items-center gap-1.5 text-[#A69C95] hover:text-[#7D6B5F] transition-colors opacity-70 hover:opacity-100"
          >
            관리자 로그인 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Footer Info */}
      <div className="z-10 mt-12 text-[10px] text-[#A69C95] tracking-widest uppercase font-sans font-light">
        © 2026 VOW SEOUL. All rights reserved.
      </div>
    </div>
  )
}
