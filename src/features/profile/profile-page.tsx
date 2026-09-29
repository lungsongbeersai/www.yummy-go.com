"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useChangePasswordForm } from "@/hooks/use-change-password-form";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { Building2, Camera, KeyRound, Mail, Phone, Save, Store, type LucideIcon } from "lucide-react";
import { ChangePasswordFields } from "@/components/common/change-password-fields";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { userInitials } from "@/components/layout/shell-menu-helpers";
import {
  AVATAR_CROP_ASPECT,
  AVATAR_CROP_OUTPUT_HEIGHT,
  AVATAR_CROP_OUTPUT_WIDTH
} from "@/config/image-crop";
import {
  DEFAULT_CROP,
  ImageCropDialog,
  cropImageFile,
  type CropState
} from "@/features/settings/shared/settings-image-crop";
import { SETTINGS_ACCENT } from "@/features/settings/shared/settings-tones";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

// One column that reads the same on a phone (Capacitor) and on the web: who you are on top
// (photo, store, branch), what the account is tied to, then the one thing to change here, the
// password. The photo changes in place: tap it, pick a file, crop, save.
export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updateAuthUser = useAuthStore((state) => state.updateUser);
  const showToast = useToastStore((state) => state.show);
  const changePassword = useReferenceStore((state) => state.changePassword);
  const changingPassword = useReferenceStore((state) => Boolean(state.loadingKeys.password));
  const updateProfileImage = useReferenceStore((state) => state.updateProfileImage);
  const savingAvatar = useReferenceStore((state) => Boolean(state.loadingKeys.profileImage));
  const userProfileUrl = useReferenceStore((state) => state.userProfileUrl);
  const { error, reset, setValue, validate, values } = useChangePasswordForm();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarCrop, setAvatarCrop] = useState<CropState>(DEFAULT_CROP);
  const [cropOpen, setCropOpen] = useState(false);
  const selectedUrl = useMemo(() => (selectedAvatarFile ? URL.createObjectURL(selectedAvatarFile) : ""), [selectedAvatarFile]);
  const profileSrc = user?.profile ? userProfileUrl(user.profile) : "";

  useEffect(() => {
    if (!selectedUrl) return;
    return () => URL.revokeObjectURL(selectedUrl);
  }, [selectedUrl]);

  // สลับผู้ใช้ = ล้างฟอร์มรหัสผ่านและรูปที่เลือกค้างไว้ของคนก่อน
  useResetOnChange(user?.email, () => {
    reset();
    setSelectedAvatarFile(null);
    setAvatarCrop(DEFAULT_CROP);
  });

  function pickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    // Cleared right away so picking the same file again still fires a change.
    event.target.value = "";
    if (!file) return;
    setAvatarCrop(DEFAULT_CROP);
    setSelectedAvatarFile(file);
    setCropOpen(true);
  }

  function closeCrop(open: boolean) {
    setCropOpen(open);
    // Cancelled or saved: the picked file is done with either way.
    if (!open) setSelectedAvatarFile(null);
  }

  // เรียกจากปุ่ม "บันทึก" ในกล่องครอปรูปเอง — รับค่า crop ตรงจาก dialog เพื่อไม่ให้เจอค่า
  // avatarCrop ที่ยัง sync ไม่ทัน (setState ของ React ไม่ synchronous)
  async function saveAvatar(crop: CropState) {
    if (!selectedAvatarFile || !user?.uuid) return;

    try {
      const croppedFile = await cropImageFile(selectedAvatarFile, crop, t("settings.storeBranch.imageLoadFailed"), {
        aspect: AVATAR_CROP_ASPECT,
        outputHeight: AVATAR_CROP_OUTPUT_HEIGHT,
        outputWidth: AVATAR_CROP_OUTPUT_WIDTH
      });
      const updated = await updateProfileImage({ login_uuid: user.uuid, profile: croppedFile });
      if (updated?.login_profile) updateAuthUser({ profile: updated.login_profile });
      showToast({ title: t("profile.avatarUpdated"), tone: "success" });
      setAvatarCrop(DEFAULT_CROP);
    } catch (requestError) {
      showToast({
        title: t("profile.avatarUpdateFailed"),
        description: requestError instanceof Error ? requestError.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
      // Keeps the crop dialog open so the user can retry.
      throw requestError;
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    const payload = validate();
    if (!payload) return;

    try {
      await changePassword({
        login_uuid: user?.uuid ?? "",
        old_password: payload.oldPassword,
        new_password: payload.newPassword
      });
      showToast({ title: t("profile.passwordChanged"), tone: "success" });
      reset();
    } catch (requestError) {
      showToast({
        title: t("profile.changePasswordFailed"),
        description: requestError instanceof Error ? requestError.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  const place = [user?.store_name, user?.branch_name].filter(Boolean).join(" · ");

  return (
    // Phones: one column. Wide screens: who you are on the left (kept in view while the form
    // scrolls), the password form beside it, instead of one narrow column in a wide page.
    <div className="mx-auto grid w-full max-w-5xl gap-5 pb-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <h1 className="sr-only">{t("profile.title")}</h1>

      <div className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--app-shell-header-height,4rem)+1.5rem)]">
        {/* Identity: the photo is the button that changes it (camera badge says so). */}
        <section className={cn("flex flex-col items-center gap-3 rounded-3xl px-4 pt-6 pb-5 text-center", SETTINGS_ACCENT.wash)}>
          <button
            type="button"
            aria-label={t("profile.actions.changePhoto")}
            className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
            disabled={savingAvatar || !user?.uuid}
            onClick={() => fileInputRef.current?.click()}
          >
            <Avatar className="size-28 ring-4 ring-background">
              {profileSrc ? <AvatarImage src={profileSrc} alt="" className="object-cover" /> : null}
              <AvatarFallback className="text-2xl">{userInitials(user)}</AvatarFallback>
            </Avatar>
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-0.5 bottom-0.5 flex size-9 items-center justify-center rounded-full ring-4 ring-background transition-transform group-active:scale-90 motion-reduce:transition-none",
                SETTINGS_ACCENT.solid
              )}
            >
              {savingAvatar ? <Spinner className="size-4" /> : <Camera className="size-4" />}
            </span>
          </button>
          <input
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/gif"
            className="sr-only"
            id="profile-avatar"
            tabIndex={-1}
            type="file"
            onChange={pickAvatar}
          />
          <div className="flex min-w-0 max-w-full flex-col gap-1">
            <p className="truncate text-lg font-semibold">{place || t("profile.sections.account")}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email ?? "-"}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full bg-background px-4"
            disabled={savingAvatar || !user?.uuid}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera data-icon="inline-start" />
            {t("profile.actions.changePhoto")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("settings.storeBranch.imageSupport")}</p>
        </section>

        {/* Account facts: read-only, so a list of label/value rows rather than disabled inputs. */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-3.5 [.border-b]:pb-3.5">
            <CardTitle className="text-sm font-semibold">{t("profile.sections.account")}</CardTitle>
          </CardHeader>
          <dl className="flex flex-col divide-y divide-border">
            <InfoRow icon={Mail} label={t("profile.fields.email")} value={user?.email} />
            <InfoRow icon={Store} label={t("nav.store")} value={user?.store_name} />
            <InfoRow icon={Building2} label={t("nav.branch")} value={user?.branch_name} />
            <InfoRow icon={Phone} label={t("fields.branch_tel")} value={user?.branch_tel} />
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", SETTINGS_ACCENT.soft)}
          >
            <KeyRound className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle className="text-sm font-semibold">{t("profile.sections.password")}</CardTitle>
            <CardDescription>{t("profile.sections.passwordHint")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPassword} className="flex flex-col gap-5">
            <ChangePasswordFields
              disabled={changingPassword}
              error={error}
              idPrefix="profile-password"
              values={values}
              onValueChange={setValue}
            />
            {/* Full width on phones (thumb reach), its natural width on wider screens. */}
            <Button
              className="h-11 w-full sm:ml-auto sm:h-9 sm:w-auto"
              disabled={changingPassword || !user?.uuid}
              type="submit"
            >
              {changingPassword ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {changingPassword ? t("common.processing") : t("profile.actions.updatePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {selectedAvatarFile && selectedUrl ? (
        <ImageCropDialog
          aspect={AVATAR_CROP_ASPECT}
          cropShape="round"
          open={cropOpen}
          src={selectedUrl}
          title={t("profile.actions.changePhoto")}
          value={avatarCrop}
          zoomLabel={t("settings.storeBranch.zoom")}
          onConfirm={setAvatarCrop}
          onOpenChange={closeCrop}
          onSave={saveAvatar}
        />
      ) : null}
    </div>
  );
}

// A fact the account doesn't have (e.g. no separate store name) is left out, not shown as "-".
function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-right text-sm font-medium" translate="no">
        {value}
      </dd>
    </div>
  );
}
