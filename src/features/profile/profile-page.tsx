"use client";

import { useState, type FormEvent } from "react";
import { useChangePasswordForm } from "@/hooks/use-change-password-form";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { ChangePasswordFields } from "@/components/common/change-password-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  AVATAR_CROP_ASPECT,
  AVATAR_CROP_ASPECT_CLASS,
  AVATAR_CROP_OUTPUT_HEIGHT,
  AVATAR_CROP_OUTPUT_WIDTH
} from "@/config/image-crop";
import {
  DEFAULT_CROP,
  SettingsImageCropPanel,
  cropImageFile,
  type CropState
} from "@/features/settings/shared/settings-image-crop";
import { useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

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

  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarCrop, setAvatarCrop] = useState<CropState>(DEFAULT_CROP);
  const profileSrc = user?.profile ? userProfileUrl(user.profile) : "";

  // สลับผู้ใช้ = ล้างฟอร์มรหัสผ่านและรูปที่เลือกค้างไว้ของคนก่อน
  useResetOnChange(user?.email, () => {
    reset();
    setSelectedAvatarFile(null);
    setAvatarCrop(DEFAULT_CROP);
  });

  // เรียกจากปุ่ม "บันทึก" ในกล่องครอปรูปเอง ไม่ใช่ปุ่มนอกกล่อง — รับค่า crop ตรงจาก dialog เพื่อไม่ให้
  // เจอค่า avatarCrop ที่ยัง sync ไม่ทัน (setState ของ React ไม่ synchronous)
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
      setSelectedAvatarFile(null);
      setAvatarCrop(DEFAULT_CROP);
    } catch (requestError) {
      showToast({
        title: t("profile.avatarUpdateFailed"),
        description: requestError instanceof Error ? requestError.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-black">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>{t("profile.sections.avatar")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("profile.sections.avatarHint")}</p>
          </div>
        </CardHeader>
        <CardContent>
          <SettingsImageCropPanel
            aspect={AVATAR_CROP_ASPECT}
            aspectClass={AVATAR_CROP_ASPECT_CLASS}
            className=" rounded-lg border-0 bg-transparent p-0 md:border-0"
            crop={avatarCrop}
            description={t("settings.profileImageHint")}
            emptyLabel={t("profile.sections.avatar")}
            existingSrc={profileSrc}
            fieldId="profile-avatar"
            fileSupportText={t("settings.storeBranch.imageSupport")}
            previewMaxClassName="max-w-40 sm:max-w-48"
            previewShape="circle"
            removeLabel={t("settings.storeBranch.cancelImage")}
            saving={savingAvatar}
            selectedFile={selectedAvatarFile}
            title={t("profile.actions.changePhoto")}
            uploadLabel={t("profile.actions.changePhoto")}
            zoomLabel={t("settings.storeBranch.zoom")}
            onCropChange={setAvatarCrop}
            onFileChange={setSelectedAvatarFile}
            onSave={saveAvatar}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>{t("profile.sections.account")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("profile.sections.accountHint")}</p>
          </div>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldContent>
              <FieldLabel>{t("profile.fields.email")}</FieldLabel>
              <p className="text-sm">{user?.email ?? "-"}</p>
            </FieldContent>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>{t("profile.sections.password")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("profile.sections.passwordHint")}</p>
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
            <div className="flex justify-end">
              <Button className="gap-2" disabled={changingPassword || !user?.uuid} size="sm" type="submit">
                {changingPassword ? <Spinner /> : <Save className="size-4" />}
                {changingPassword ? t("common.processing") : t("profile.actions.updatePassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
