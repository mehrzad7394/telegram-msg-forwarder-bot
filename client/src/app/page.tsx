// import { defaultLocale } from "@/config";
import { redirect } from "next/navigation";
// import { defaultLocale } from '@/config';
const defaultLocale = "fa";
// This page only renders when the app is built statically (output: 'export')
export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
