"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, type ApiModel } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

type ModelForm = {
  slug: string;
  name: string;
  provider: string;
  type: string;
  creditsCost: string;
  active: boolean;
  watermark: boolean;
};

const emptyForm: ModelForm = {
  slug: "",
  name: "",
  provider: "",
  type: "video",
  creditsCost: "10",
  active: true,
  watermark: false,
};

export default function AdminModelsPage() {
  const [items, setItems] = React.useState<ApiModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState<ModelForm>(emptyForm);
  const [editing, setEditing] = React.useState<ApiModel | null>(null);
  const [editForm, setEditForm] = React.useState<ModelForm>(emptyForm);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.adminListModels(true);
    if (res.error) toast({ title: "Failed to load models", description: res.error, variant: "destructive" });
    else if (res.data) setItems(res.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toPayload = (f: ModelForm) => ({
    slug: f.slug,
    name: f.name,
    provider: f.provider,
    type: f.type || undefined,
    creditsCost: Number(f.creditsCost),
    active: f.active,
    watermark: f.watermark,
  });

  const handleCreate = async () => {
    setSaving(true);
    const res = await api.adminCreateModel(toPayload(form));
    setSaving(false);
    if (res.error) toast({ title: "Create failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Model created", variant: "success" });
      setShowCreate(false);
      setForm(emptyForm);
      load();
    }
  };

  const startEdit = (m: ApiModel) => {
    setEditing(m);
    setEditForm({
      slug: m.slug,
      name: m.name,
      provider: m.provider,
      type: m.type,
      creditsCost: String(m.creditsCost),
      active: m.active,
      watermark: !!m.watermark,
    });
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await api.adminUpdateModel(editing.id, {
      name: editForm.name,
      provider: editForm.provider,
      type: editForm.type,
      creditsCost: Number(editForm.creditsCost),
      active: editForm.active,
      watermark: editForm.watermark,
    });
    setSaving(false);
    if (res.error) toast({ title: "Update failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Model updated", variant: "success" });
      setEditing(null);
      load();
    }
  };

  const handleDelete = async (m: ApiModel) => {
    if (!window.confirm(`Delete model ${m.name}?`)) return;
    const res = await api.adminDeleteModel(m.id);
    if (res.error) toast({ title: "Delete failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Model deleted", variant: "success" });
      load();
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Models</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" /> {showCreate ? "Hide" : "New Model"}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Credits Cost</Label>
                <Input value={form.creditsCost} onChange={(e) => setForm({ ...form, creditsCost: e.target.value })} />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.watermark} onChange={(e) => setForm({ ...form, watermark: e.target.checked })} />
                  Watermark
                </label>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="font-medium">Edit: {editing.name}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <Input value={editForm.provider} onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Input value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Credits Cost</Label>
                <Input value={editForm.creditsCost} onChange={(e) => setEditForm({ ...editForm, creditsCost: e.target.value })} />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editForm.watermark} onChange={(e) => setEditForm({ ...editForm, watermark: e.target.checked })} />
                  Watermark
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdate} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Slug</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Cost</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs">{m.slug}</td>
                  <td className="px-3 py-2">{m.name}</td>
                  <td className="px-3 py-2">{m.provider}</td>
                  <td className="px-3 py-2">{m.type}</td>
                  <td className="px-3 py-2">{m.creditsCost}</td>
                  <td className="px-3 py-2">
                    {m.active ? <Badge>active</Badge> : <Badge variant="outline">inactive</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(m)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(m)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No models
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}