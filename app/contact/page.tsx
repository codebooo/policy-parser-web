"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"

export default function ContactPage() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        setIsVisible(true)
    }, [])

    return (
        <div className="container mx-auto px-4 py-20 max-w-2xl">
            <Card className={`bg-white/5 border-white/10 backdrop-blur-sm transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <CardHeader className={`transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <CardTitle>Contact Us</CardTitle>
                    <CardDescription>Have questions or feedback? We'd love to hear from you.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4">
                        <div className={`space-y-2 transition-all duration-700 delay-150 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" placeholder="Your name" className="bg-white/5 border-white/10" />
                        </div>
                        <div className={`space-y-2 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="your@email.com" className="bg-white/5 border-white/10" />
                        </div>
                        <div className={`space-y-2 transition-all duration-700 delay-250 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <Label htmlFor="message">Message</Label>
                            <Textarea id="message" placeholder="How can we help?" className="bg-white/5 border-white/10 min-h-[150px]" />
                        </div>
                        <Button type="submit" className={`w-full transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>Send Message</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
