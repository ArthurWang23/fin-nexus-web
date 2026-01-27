"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState("");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/v1/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Registration failed");
            }

            // Success
            router.push("/auth/login?registered=true");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full bg-white/10 border-white/20 backdrop-blur-md text-white shadow-xl">
            <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription className="text-gray-300">
                    Join Fin-Nexus to start your financial journey
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium leading-none">Email</label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-400 focus-visible:ring-blue-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium leading-none">Password</label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-400 focus-visible:ring-blue-500 pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">Must be at least 6 characters</p>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-sm font-medium leading-none">Confirm Password</label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-400 focus-visible:ring-blue-500"
                        />
                    </div>
                    {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
                </CardContent>
                <CardFooter className="flex flex-col space-y-2 pt-6">
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...</> : "Register"}
                    </Button>
                    <div className="text-center text-sm text-gray-400">
                        Already have an account?{" "}
                        <Link href="/auth/login" className="text-blue-400 hover:underline hover:text-blue-300">
                            Login
                        </Link>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}
