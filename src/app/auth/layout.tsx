import type { Metadata } from "next";
import { AnimatedBackground } from "@/components/ui/animated-background";

export const metadata: Metadata = {
    title: "Authentication | Fin-Nexus",
    description: "Login or Register to Fin-Nexus",
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
            <AnimatedBackground />
            <div className="w-full max-w-sm space-y-4">
                <div className="flex flex-col items-center space-y-2 text-center">
                    {/* You could add a logo here */}
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">Fin-Nexus</h1>
                    <p className="text-sm text-gray-400">Your AI Financial Assistant</p>
                </div>
                {children}
            </div>
        </div>
    );
}
