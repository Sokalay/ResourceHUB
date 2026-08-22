import { redirect } from "next/navigation";

export default function TeamPresentationRedirect({ params }: { params: { id: string } }) {
  redirect(`/teams/${params.id}`);
}
