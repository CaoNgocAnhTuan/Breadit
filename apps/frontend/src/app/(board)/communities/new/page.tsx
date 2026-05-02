import CreateCommunityForm from "./CreateCommunityForm";

export default function NewCommunityPage() {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create a Community</h1>
      <CreateCommunityForm />
    </div>
  );
}
