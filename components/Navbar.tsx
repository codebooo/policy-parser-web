import Link from "next/link"
import { ShieldCheck, Shield } from "lucide-react"
import { Button } from "./ui/button"
import { createClient } from "@/utils/supabase/server"
import { UserNav } from "./UserNav"

export async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/5 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">PolicyParser</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/plans" className="hover:text-foreground transition-colors">Plans</Link>
          <Link href="/how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <Link href="/support" className="hover:text-foreground transition-colors">Support Me</Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <UserNav user={user} />
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full px-6">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
