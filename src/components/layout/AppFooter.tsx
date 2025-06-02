export function AppFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-6 md:px-6 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Agentor. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
