import { Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import gogodeepLogo from "@/assets/gogodeep-logo.png";
import ExamMarquee from "@/components/ExamMarquee";

const AppNav = ({ user }: { user: User | null | undefined }) => {
  return (
    <nav className="fixed top-4 left-0 right-0 z-50 px-4">
      <div className="mx-auto flex h-16 sm:h-20 max-w-5xl items-center justify-between rounded-2xl border border-primary/40 bg-gradient-to-b from-[hsl(225,65%,20%)] to-[hsl(225,65%,13%)] px-4 sm:px-7 shadow-[0_0_40px_hsl(225,75%,55%,0.18),inset_0_1px_0_hsl(225,75%,75%,0.18)] backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img src={gogodeepLogo} alt="Gogodeep" className="h-7 w-7 sm:h-8 sm:w-8 object-contain" />
          <span className="text-base font-bold tracking-tight text-foreground">Gogodeep</span>
        </Link>

        <div className="hidden sm:block"><ExamMarquee width={340} /></div>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <Link to="/dashboard">
              <Button className="h-11 px-7 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/workspace">
              <Button className="h-11 px-7 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90">
                Start Now
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default AppNav;
