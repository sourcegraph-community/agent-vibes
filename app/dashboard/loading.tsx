export default function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center space-y-4">
        <div className="size-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    </div>
  );
}
