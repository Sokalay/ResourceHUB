"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CascadingCategorySelector } from "@/components/cascading-category-selector";
import { classifications, resourceTypes, sourceKinds, sourceProviders, storageProviders } from "@/lib/constants";

type Option = { id: string; name: string; email?: string };
type CategoryOption = { id: string; name: string; path: string; parentId: string | null; level: number };
type ProjectOption = { id: string; name: string; teamId: string; team: { name: string }; leadUser: { name: string } };

export function ResourceForm({
  users,
  teams,
  projects,
  categories,
  currentUserId,
  currentUserName,
  isAdmin
}: {
  users: Option[];
  teams: Option[];
  projects: ProjectOption[];
  categories: CategoryOption[];
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [summary, setSummary] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const steps = ["Basic Info", "Category", "Account", "Source", "Review"];
  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  function refreshSummary(form: HTMLFormElement) {
    const data = new FormData(form);
    const file = data.get("file");
    setSummary({
      name: String(data.get("name") || "-"),
      type: String(data.get("resourceType") || "-"),
      classification: String(data.get("classification") || "-"),
      project: selectedProject?.name ?? "No project",
      team: selectedProject?.team.name ?? teams.find((team) => team.id === data.get("teamId"))?.name ?? "-",
      owner: isAdmin ? users.find((user) => user.id === data.get("ownerUserId"))?.name ?? currentUserName : currentUserName,
      source: file instanceof File && file.size > 0 ? `Upload: ${file.name}` : String(data.get("sourceUrl") || data.get("currentWorkingLocation") || "-"),
      access: data.get("sourceAccessGranted") === "on" ? "Read access confirmed" : "Access not confirmed"
    });
  }

  return (
    <form
      className="surface grid gap-5 rounded-lg p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        const form = new FormData(event.currentTarget);
        const file = form.get("file");
        const sourceProvider = file instanceof File && file.size > 0 ? "DIRECT_UPLOAD" : form.get("sourceProvider");
        const project = projects.find((entry) => entry.id === form.get("projectId"));
        const response = await fetch("/api/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            description: form.get("description"),
            resourceType: form.get("resourceType"),
            classification: form.get("classification"),
            primaryCategoryId: form.get("primaryCategoryId") || null,
            projectId: form.get("projectId") || null,
            ownerUserId: form.get("ownerUserId"),
            teamId: project?.teamId ?? form.get("teamId"),
            currentWorkingLocation: form.get("currentWorkingLocation"),
            sourceProvider,
            sourceKind: form.get("sourceKind"),
            sourceUrl: form.get("sourceUrl") || form.get("currentWorkingLocation"),
            storageProvider: file instanceof File && file.size > 0 ? "LOCAL" : form.get("storageProvider"),
            sourceAccessGranted: form.get("sourceAccessGranted") === "on",
            tags: form.get("tags"),
            hasUpload: file instanceof File && file.size > 0,
            sourceLocation: form.get("sourceUrl") || form.get("currentWorkingLocation")
          })
        });
        if (!response.ok) {
          setLoading(false);
          setError((await response.json()).error ?? "Could not create resource");
          return;
        }
        const { resource } = await response.json();
        if (file instanceof File && file.size > 0) {
          const upload = new FormData();
          upload.set("file", file);
          upload.set("versionName", String(form.get("versionName") || "v1"));
          upload.set("versionDescription", String(form.get("versionDescription") || ""));
          const uploadResponse = await fetch(`/api/resources/${resource.id}/upload`, { method: "POST", body: upload });
          if (!uploadResponse.ok) {
            setLoading(false);
            setError((await uploadResponse.json()).error ?? "Resource created, but upload failed");
            return;
          }
        }
        router.push(`/resources/${resource.id}`);
        router.refresh();
      }}
    >
      <div className="grid gap-2 rounded-md bg-slate-50 p-2 md:grid-cols-5">
        {steps.map((label, index) => (
          <button
            className={`rounded-md border px-3 py-2 text-left text-sm font-semibold ${step === index + 1 ? "border-ink bg-ink text-white shadow-sm" : "border-transparent bg-white text-slate-700 hover:border-line"}`}
            key={label}
            onClick={(event) => {
              refreshSummary(event.currentTarget.form!);
              setStep(index + 1);
            }}
            type="button"
          >
            <span className="block text-xs opacity-70">Step {index + 1}</span>
            {label}
          </button>
        ))}
      </div>

      <section className={step === 1 ? "grid gap-4" : "hidden"}>
        <h2 className="section-title">Basic Info</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label>Name<input name="name" required minLength={3} maxLength={120} /></label>
          <label>Resource Type<select name="resourceType" required>{resourceTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Classification<select name="classification" required>{classifications.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Tags<input name="tags" placeholder="khmer, ocr, training-data" /></label>
        </div>
        <label>Description<textarea name="description" rows={3} /></label>
      </section>

      <section className={step === 2 ? "grid gap-4" : "hidden"}>
        <h2 className="section-title">Category</h2>
        <CascadingCategorySelector categories={categories} showManageLink />
      </section>

      <section className={step === 3 ? "grid gap-4" : "hidden"}>
        <h2 className="section-title">Account Context</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">Project<select name="projectId" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}><option value="">No project / team resource</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} - {project.team.name}</option>)}</select></label>
          {selectedProject ? (
            <div>
              <div className="text-sm font-semibold text-slate-600">Owning Team</div>
              <div className="mt-2 rounded-md border border-line bg-panel px-3 py-2">{selectedProject.team.name}</div>
              <input name="teamId" type="hidden" value={selectedProject.teamId} />
            </div>
          ) : (
            <label>Team<select name="teamId" required>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          )}
          {isAdmin ? (
            <label>Owner<select name="ownerUserId" defaultValue={currentUserId} required>{users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select></label>
          ) : (
            <div>
              <div className="text-sm font-semibold text-slate-600">Owner</div>
              <div className="mt-2 rounded-md border border-line bg-panel px-3 py-2">{currentUserName}</div>
              <input name="ownerUserId" type="hidden" value={currentUserId} />
            </div>
          )}
        </div>
        <p className="text-sm text-slate-600">For project resources, the project owning team is used automatically. Cross-team collaborators keep their own account as the submitter.</p>
      </section>

      <section className={step === 4 ? "grid gap-4 rounded-md border border-line bg-slate-50 p-4" : "hidden"}>
        <h2 className="section-title">Source Information</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <label>Source Provider<select name="sourceProvider" defaultValue="MANUAL">{sourceProviders.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Source Kind<select name="sourceKind" defaultValue="OTHER">{sourceKinds.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Storage Provider<select name="storageProvider" defaultValue="LOCAL">{storageProviders.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label>Source URL<input name="sourceUrl" placeholder="Provider URL, repository, file, folder, or API endpoint" /></label>
          <label>Current Working Location<input name="currentWorkingLocation" placeholder="Existing path, URL, or working location note" /></label>
        </div>
        <label className="flex items-start gap-3 rounded-md border border-line bg-panel p-3 text-sm">
          <input className="mt-1 w-auto" name="sourceAccessGranted" type="checkbox" />
          <span>I have granted read-only access to the Resource Hub service account for this external source, if access is required.</span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label>Initial Version Name<input name="versionName" defaultValue="v1" /></label>
          <label>Upload File or ZIP<input name="file" type="file" /></label>
        </div>
        <label>Version Notes<textarea name="versionDescription" rows={2} /></label>
      </section>

      <section className={step === 5 ? "grid gap-4 rounded-md border border-line bg-slate-50 p-4" : "hidden"}>
        <h2 className="section-title">Review</h2>
        <p className="text-sm text-slate-600">Submit creates a team-only resource. Direct uploads are staged first and become official only after team lead approval. External sources should grant read-only access to the Resource Hub service account before review.</p>
        <div className="grid gap-3 rounded-md border border-line bg-white p-4 text-sm md:grid-cols-2">
          <div><div className="text-xs font-semibold uppercase text-slate-500">Resource</div><div className="mt-1 font-semibold">{summary.name ?? "-"}</div></div>
          <div><div className="text-xs font-semibold uppercase text-slate-500">Type / Classification</div><div className="mt-1">{summary.type ?? "-"} / {summary.classification ?? "-"}</div></div>
          <div><div className="text-xs font-semibold uppercase text-slate-500">Team</div><div className="mt-1">{summary.team ?? "-"}</div></div>
          <div><div className="text-xs font-semibold uppercase text-slate-500">Project</div><div className="mt-1">{summary.project ?? "No project"}</div></div>
          <div><div className="text-xs font-semibold uppercase text-slate-500">Owner</div><div className="mt-1">{summary.owner ?? "-"}</div></div>
          <div className="md:col-span-2"><div className="text-xs font-semibold uppercase text-slate-500">Source</div><div className="mt-1 break-all">{summary.source ?? "-"}</div></div>
          <div className="md:col-span-2"><div className="text-xs font-semibold uppercase text-slate-500">Access</div><div className="mt-1">{summary.access ?? "-"}</div></div>
        </div>
      </section>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="flex gap-2">
        {step > 1 && <button className="rounded-md border border-line px-4 py-2 font-semibold" onClick={() => setStep((current) => Math.max(1, current - 1))} type="button">Back</button>}
        {step < 5 && <button className="rounded-md bg-ink px-4 py-2 font-semibold text-white" onClick={(event) => {
          refreshSummary(event.currentTarget.form!);
          setStep((current) => Math.min(5, current + 1));
        }} type="button">Next</button>}
        {step === 5 && <button className="rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>{loading ? "Submitting..." : "Submit Resource"}</button>}
      </div>
    </form>
  );
}
