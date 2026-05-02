import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import Logout from "@/components/Logout";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Admin Sidebar */}
      <div className="w-64 border-r border-borderGray p-4 flex flex-col gap-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🛡️</span>
          <h1 className="text-xl font-bold text-red-400">Admin</h1>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          <Link href="/admin-console/users" className="p-3 rounded hover:bg-[#181818]">
            Manage Users
          </Link>
          <Link href="/admin-console/reports" className="p-3 rounded hover:bg-[#181818]">
            Reported Content
          </Link>
        </nav>

        <div className="mt-auto border-t border-borderGray pt-4">
          <Link href="/" className="p-3 rounded hover:bg-[#181818] block text-center mb-2">
            Back to App
          </Link>
          <div className="flex justify-center p-3">
            <Logout />
          </div>
        </div>
      </div>

      {/* Admin Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {children}
      </div>
    </div>
  );
}
