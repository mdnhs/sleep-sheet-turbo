"use client";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";

import {
  Form,
  FormItem,
  FormField,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { z } from "zod";
import Link from "next/link";
import { LoginSchema } from "../schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin } from "../api/use-login";
import { useLanguage } from "@/hooks/use-language";

function SignInCard() {
  const { language } = useLanguage();
  const isBn = language === "bn";
  const { mutate, isPending } = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const onSubmit = (value: z.infer<typeof LoginSchema>) => {
    mutate({ json: value });
  };

  return (
    <Card className="w-full border-none shadow-none ring-0">
      <CardHeader>
        <CardTitle className=" text-center">
          <h1 className=" text-2xl font-bold text-center mb-2">
            {isBn ? "লগ ইন করুন" : "Sign In"}
          </h1>
        </CardTitle>
        <p className=" text-muted-foreground text-center">
          {isBn
            ? "স্বাগতম! কেনাকাটা চালিয়ে যেতে আপনার অ্যাকাউন্টে লগ ইন করুন।"
            : "Welcome back! Sign in to your account to continue shopping."}
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className=" space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <label className=" text-sm font-semibold">
                    {isBn ? "ইমেইল ঠিকানা" : "Email Address"}
                  </label>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={isBn ? "ইমেইল" : "Email"}
                      {...field}
                      className="w-full "
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="password"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <label className=" text-sm font-semibold">
                    {isBn ? "পাসওয়ার্ড" : "Password"}
                  </label>
                  <div className=" relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={isBn ? "পাসওয়ার্ড" : "Password"}
                        {...field}
                        className="w-full "
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className=" flex justify-start items-center">
              <label className=" flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary border-gray-300 dark:border-slate-600 rounded focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">
                  {isBn ? "আমাকে মনে রাখুন" : "Remember me"}
                </span>
              </label>
            </div>
            <Button type="submit" size="lg" className=" w-full" disabled={isPending}>
              {isBn ? "লগ ইন" : "Login"}
            </Button>
          </form>
        </Form>
        <p className=" text-md text-muted-foreground text-center mt-4">
          {isBn ? "অ্যাকাউন্ট নেই?" : "Don't have an account?"}{" "}
          <Link href={"/signup"}>
            <span className=" text-primary font-bold cursor-pointer">
              {isBn ? "অ্যাকাউন্ট তৈরি করুন" : "Create Account"}
            </span>
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default SignInCard;
