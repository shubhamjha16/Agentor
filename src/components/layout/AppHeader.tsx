import { BotMessageSquare } from "lucide-react";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <BotMessageSquare className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-headline font-bold text-foreground">
            Agentor
          </h1>
        </Link>
        <p className="text-sm text-muted-foreground hidden sm:block">Create AI agents, no code required.</p>
      </div>
    </header>
  );
}
