import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-background/60 backdrop-blur-md py-8 mt-12">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} PolicyParser. All rights reserved.
        </div>
        <div className="flex gap-6 text-sm font-medium">
          <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors duration-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors duration-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  )
}
