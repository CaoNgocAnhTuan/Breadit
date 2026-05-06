import Link from "next/link";
import Image from "./Image";
import Socket from "./Socket";
import Notification from "./Notification";
import MessagesBadge from "./MessagesBadge";
import { getSession } from "@/lib/session";
import Logout from "./Logout";

const menuList = [
  {
    id: 1,
    name: "Homepage",
    link: "/",
    icon: "home.svg",
  },
  {
    id: 2,
    name: "Explore",
    link: "/",
    icon: "explore.svg",
  },
  {
    id: 3,
    name: "Notifications",
    link: "/notifications",
    icon: "notification.svg",
  },
  {
    id: 4,
    name: "Messages",
    link: "/",
    icon: "message.svg",
  },
  {
    id: 5,
    name: "Bookmarks",
    link: "/",
    icon: "bookmark.svg",
  },
  {
    id: 7,
    name: "Communities",
    link: "/communities",
    icon: "community.svg",
  },
  {
    id: 9,
    name: "Profile",
    link: "/",
    icon: "profile.svg",
  },
  {
    id: 10,
    name: "More",
    link: "/",
    icon: "more.svg",
  },
];

const LeftBar = async () => {
  const session = await getSession();
  const user = session?.user;

  return (
    <div className="h-screen sticky top-0 flex flex-col justify-between pt-2 pb-8 gap-8">
      {/* LOGO MENU BUTTON */}
      <div className="flex flex-col gap-4 text-lg items-center xxl:items-start flex-1 overflow-y-auto no-scrollbar">
        {/* LOGO */}
        <Link
          href="/"
          className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-3"
        >
          <Image path="icons/logo.svg" alt="logo" w={30} h={30} />
          <span className="hidden xxl:inline font-bold tracking-tight">Breadit</span>
        </Link>
        {/* MENU LIST */}
        <div className="flex flex-col gap-4">
          {menuList.map((item) => (
            <div key={item.id}>
              {item.id === 3 ? (
                user ? (
                  <Notification />
                ) : (
                  <Link
                    href={item.link}
                    className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
                  >
                    <Image path={`icons/${item.icon}`} alt={item.name} w={24} h={24} />
                    <span className="hidden xxl:inline">{item.name}</span>
                  </Link>
                )
              ) : item.id === 4 ? (
                user ? (
                  <MessagesBadge />
                ) : (
                  <Link
                    href="/messages"
                    className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
                  >
                    <Image path={`icons/${item.icon}`} alt={item.name} w={24} h={24} />
                    <span className="hidden xxl:inline">{item.name}</span>
                  </Link>
                )
              ) : item.id === 5 ? (
                <Link
                  href={user ? "/bookmarks" : "/sign-in"}
                  className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
                >
                  <Image path={`icons/${item.icon}`} alt={item.name} w={24} h={24} />
                  <span className="hidden xxl:inline">{item.name}</span>
                </Link>
              ) : item.id === 9 ? (
                <Link
                  href={user ? `/${user.username}` : "/sign-in"}
                  className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
                >
                  <Image path={`icons/${item.icon}`} alt={item.name} w={24} h={24} />
                  <span className="hidden xxl:inline">{item.name}</span>
                </Link>
              ) : (
                <Link
                  href={item.link}
                  className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
                >
                  <Image path={`icons/${item.icon}`} alt={item.name} w={24} h={24} />
                  <span className="hidden xxl:inline">{item.name}</span>
                </Link>
              )}
            </div>
          ))}
          {user?.role === 'ADMIN' && (
            <div>
              <Link
                href="/admin-console"
                className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
              >
                <span className="text-2xl">🛡️</span>
                <span className="hidden xxl:inline text-red-400 font-bold">Admin Console</span>
              </Link>
            </div>
          )}
        </div>
        {/* BUTTON */}
        <Link
          href="/compose/post"
          className="bg-white text-black rounded-full w-12 h-12 flex items-center justify-center xxl:hidden"
        >
          <Image path="icons/post.svg" alt="new post" w={24} h={24} />
        </Link>
        <Link
          href="/compose/post"
          className="hidden xxl:block bg-white text-black rounded-full font-bold py-2 px-14 text-center mb-6"
        >
          Post
        </Link>
      </div>
      {user && (
        <>
          <Socket />
          {/* USER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 relative rounded-full overflow-hidden">
                <Image
                  path={user?.img || "general/noAvatar.png"}
                  alt=""
                  fill
                  className="object-cover object-center"
                  tr={true}
                />
              </div>
              <div className="hidden xxl:flex flex-col">
                <span className="font-bold">{user?.username}</span>
                <span className="text-sm text-textGray">@{user?.username}</span>
              </div>
            </div>
            <Logout />
          </div>
        </>
      )}
    </div>
  );
};

export default LeftBar;
