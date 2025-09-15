"use client";
import { useEffect } from "react";
import { ensureLiff } from "@/lib/liffClient";
export default function Page(){
  useEffect(()=>{ ensureLiff(process.env.NEXT_PUBLIC_LIFF_DIARY_ID!); },[]);
  return <div className="p-6">絵日記の一覧/誘導ページ（slug個別は内部遷移）</div>;
}
