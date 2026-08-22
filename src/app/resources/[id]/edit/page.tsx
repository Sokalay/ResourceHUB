import { redirect } from "next/navigation";

export default function DocumentEditRedirect({ params }: { params: { id: string } }) {
  redirect(`/resources/${params.id}`);
}
