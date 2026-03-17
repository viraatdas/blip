export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      {children}
    </div>
  );
}
