"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_CROP,
  type CropState,
} from "@/features/settings/shared/settings-image-crop";
import {
  buildCategoryPayload,
  categoryValue,
  groupLabel,
  missingCategoryField,
} from "@/features/settings/category/category-utils";
import { buildSizePayload, missingSizeField } from "@/features/settings/size/size-utils";
import { buildUnitPayload, missingUnitField } from "@/features/settings/unit/unit-utils";
import { getProductImageUrl } from "@/services/product";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCategoryStore } from "@/stores/category-store";
import { useSizeStore } from "@/stores/size-store";
import { useToastStore } from "@/stores/toast-store";
import { useUnitStore } from "@/stores/unit-store";
import type {
  BinaryFlag,
  SizeSelectOption,
  StatusSortFk,
} from "./product-form-types";
import {
  CATEGORY_NAME_KEYS,
  CUSTOM_COLOR_VALUE,
  DEFAULT_COLOR,
  EMPTY_PRODUCT_FORM_DEFAULTS,
  SIZE_NAME_KEYS,
  TOPPING_HAS,
  TOPPING_NONE,
  UNIT_NAME_KEYS,
  binaryFlag,
  buildSaveProductPayload,
  categoryUuid,
  colorCode,
  detailFromProduct,
  emptyDetail,
  findOptionByText,
  generateProdCode,
  hasEditableProductData,
  includeSelectedOption,
  isHexColor,
  mergeProductFormToppingPrices,
  nextBulkStockMode,
  normalizeDetailsForStatus,
  productCategoryUuid,
  productColorValue,
  productFormDefaultsForOptions,
  productFormSizeOptions,
  productHydrationKey,
  productImageStatus,
  productUnitUuid,
  readProductFormDefaults,
  rawProductImage,
  requiredFieldErrors as getRequiredFieldErrors,
  sizeUuid,
  unitUuid,
  writeProductFormDefaults,
} from "./product-form-utils";
import { useProductFormDetails } from "./use-product-form-details";
import { useProductImageWorkflow } from "./use-product-form-image";
import { useProductFormReferenceData } from "./use-product-form-reference-data";
import { useProductSetOptionsWorkflow } from "./use-product-set-options-workflow";
import { useProductToppingsWorkflow } from "./use-product-toppings-workflow";

type ProductFormSaveNotice = "idle" | "saving" | "saved";

const SAVE_NOTICE_CLEAR_DELAY_MS = 6000;

function browserProductFormStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function scrollProductFormToTop() {
  if (typeof window === "undefined") return;

  window.requestAnimationFrame(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  });
}

export function useProductFormWorkflow() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prodUuid = searchParams.get("prod_uuid") ?? "";
  const isEditing = Boolean(prodUuid);

  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const saveCategoryRow = useCategoryStore((state) => state.save);
  const categorySaving = useCategoryStore((state) => state.saving);
  const saveUnitRow = useUnitStore((state) => state.save);
  const unitSaving = useUnitStore((state) => state.saving);
  const saveSizeRow = useSizeStore((state) => state.save);
  const sizeSaving = useSizeStore((state) => state.saving);
  const [statusSortFk, setStatusSortFk] = useState<StatusSortFk>("1");
  const {
    categories,
    colors,
    createSizeForStatus,
    createToppingRow,
    deleteSizeForStatus,
    deleteToppingRow,
    groups,
    loadCategories,
    loadProducts,
    loadSizes,
    loadSizesByStatus,
    loadToppings,
    loadUnits,
    productLoading,
    productSizesByStatus,
    productSizesByStatusStatus,
    rows,
    saveProduct,
    saving,
    sizes,
    toppingSaving,
    toppings,
    units,
    updateDetailsStock
  } = useProductFormReferenceData({ language, showToast, statusSortFk, storeUuid, t });

  const editing = useMemo(
    () => (isEditing ? rows.find((row) => row.prod_uuid === prodUuid) ?? null : null),
    [isEditing, prodUuid, rows]
  );
  const editingHydrationKey = useMemo(() => productHydrationKey(editing), [editing]);
  const editDataReady = !isEditing || Boolean(editing);

  const [prodCode, setProdCode] = useState(generateProdCode);
  const [prodNameLa, setProdNameLa] = useState("");
  const [prodNameEng, setProdNameEng] = useState("");
  const [cateUuidFk, setCateUuidFk] = useState("");
  const [uniteUuidFk, setUniteUuidFk] = useState("");
  const [prodOrderPoint, setProdOrderPoint] = useState("5");
  const [prodNotification, setProdNotification] = useState<BinaryFlag>("2");
  const [prodSetPrice, setProdSetPrice] = useState("0");
  const [prodStatusImge, setProdStatusImge] = useState<BinaryFlag>("2");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [colorValue, setColorValue] = useState(DEFAULT_COLOR);
  const [colorChoice, setColorChoice] = useState(CUSTOM_COLOR_VALUE);
  const [storedDefaults, setStoredDefaults] = useState(EMPTY_PRODUCT_FORM_DEFAULTS);
  const [saveNotice, setSaveNotice] = useState<ProductFormSaveNotice>("idle");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [sizeTargetDetailId, setSizeTargetDetailId] = useState("");
  const {
    bulkStockSaving,
    detailStockState,
    details,
    setDetails,
    addDetail,
    updateDetail,
    updateAllDetailStockModes,
    removeDetail
  } = useProductFormDetails({ isEditing, showToast, statusSortFk, t, updateDetailsStock });
  const {
    deletingSetOptionUuid,
    editingSetOptionUuid,
    filteredSetOptionOptions,
    handleSetOptionDialogOpen,
    openSetOptionDialog,
    resetSetOptionForm,
    setDeletingSetOptionUuid,
    setOptionDialogOpen,
    setOptionNameEng,
    setOptionNameLa,
    setOptionOptions,
    setOptionSaving,
    setOptionSearch,
    setSetOptionNameEng,
    setSetOptionNameLa,
    setSetOptionSearch,
    editSetOption,
    saveSetOptionFromDialog,
    deleteSetOptionFromDialog
  } = useProductSetOptionsWorkflow({
    createSizeForStatus,
    deleteSizeForStatus,
    language,
    loadSizesByStatus,
    productSizesByStatus,
    setDetails,
    showToast,
    statusSortFk,
    storeUuid,
    t,
    updateDetail
  });
  const {
    deletingToppingUuid,
    editingToppingUuid,
    filteredToppingOptions,
    newToppingNameEng,
    newToppingNameLa,
    newToppingPrice,
    prodToppingStatus,
    selectedToppingBadges,
    selectedToppingMap,
    selectedToppings,
    resetToppingSelection,
    setDeletingToppingUuid,
    setNewToppingNameEng,
    setNewToppingNameLa,
    setNewToppingPrice,
    setProdToppingStatus,
    setToppingDialogOpen,
    setToppingSearch,
    toppingDialogOpen,
    toppingOptions,
    toppingSearch,
    toggleTopping,
    updateToppingPrice,
    resetNewToppingForm,
    editTopping,
    saveToppingFromDialog,
    deleteToppingFromDialog
  } = useProductToppingsWorkflow({
    createToppingRow,
    defaultToppingPrices: storedDefaults.toppingPrices,
    deleteToppingRow,
    editing,
    editingHydrationKey,
    language,
    loadToppings,
    showToast,
    storeUuid,
    t,
    toppings
  });
  const [editLoadKey, setEditLoadKey] = useState("");
  const rawExistingImage = rawProductImage(editing);
  const { productImagePayload, selectedImagePreview } = useProductImageWorkflow({
    colorValue,
    crop,
    imageLoadFailedLabel: t("settings.storeBranch.imageLoadFailed"),
    prodStatusImge,
    rawExistingImage,
    selectedImage
  });

  useEffect(() => {
    if (!storeUuid) {
      setStoredDefaults(EMPTY_PRODUCT_FORM_DEFAULTS);
      return;
    }

    const storage = browserProductFormStorage();
    if (!storage) return;
    setStoredDefaults(readProductFormDefaults(storage, storeUuid));
  }, [storeUuid]);

  useEffect(() => {
    if (saveNotice !== "saved") return;

    const timeoutId = window.setTimeout(() => {
      setSaveNotice("idle");
    }, SAVE_NOTICE_CLEAR_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [saveNotice]);

  useEffect(() => {
    const matched = colors.find((color) => colorCode(color).toLowerCase() === colorValue.toLowerCase());
    setColorChoice(matched?.color_uuid ?? CUSTOM_COLOR_VALUE);
  }, [colors, colorValue]);

  useEffect(() => {
    if (!isEditing) {
      setEditLoadKey("");
      return;
    }
    if (!user?.branch_uuid || hasEditableProductData(editing)) return;

    const nextEditLoadKey = `${prodUuid}:${language}:${user.branch_uuid}`;
    if (editLoadKey === nextEditLoadKey) return;

    setEditLoadKey(nextEditLoadKey);
    void loadProducts({
      branch_uuid_fk: user.branch_uuid,
      cate_uuid_fk: "",
      lang: language,
      limit: "All",
      page: 1,
      search: ""
    })
      .then((products) => {
        if (!products.some((product) => product.prod_uuid === prodUuid)) {
          showToast({ title: t("settings.saveFailed"), description: t("product.loadFailed"), tone: "error" });
        }
      })
      .catch((error) => {
        showToast({
          title: t("product.loadFailed"),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });
  }, [editLoadKey, editing, isEditing, language, loadProducts, prodUuid, showToast, t, user?.branch_uuid]);

  useEffect(() => {
    if (!editing) return;
    setProdCode(String(editing.prod_code ?? generateProdCode()));
    setProdNameLa(String(editing.prod_name_la ?? editing.prod_name ?? ""));
    setProdNameEng(String(editing.prod_name_eng ?? editing.prod_name ?? ""));
    setCateUuidFk(productCategoryUuid(editing));
    setUniteUuidFk(productUnitUuid(editing));
    setProdOrderPoint(String(editing.prod_order_point ?? 5));
    setProdNotification(binaryFlag(editing.prod_notification, "2"));
    const status = String(editing.status_sort_fk ?? "1");
    const nextStatus: StatusSortFk = status === "2" || status === "3" ? status : "1";
    setStatusSortFk(nextStatus);
    setProdSetPrice(String(editing.prod_set_price ?? 0));
    setProdStatusImge(productImageStatus(editing));
    const savedColor = productColorValue(editing);
    if (savedColor) {
      setColorValue(savedColor);
      setProdStatusImge("2");
    }
    setSelectedImage(null);
    setCrop(DEFAULT_CROP);
    if (editing.details?.length) {
      setDetails(editing.details.map((detail) => detailFromProduct(detail, nextStatus)));
    }
  }, [editing, editingHydrationKey, setDetails]);

  function changeStatusSort(value: StatusSortFk) {
    setDetails((current) => normalizeDetailsForStatus(current, value, statusSortFk));
    setStatusSortFk(value);
    if (value !== "2") setProdSetPrice("0");
    if (value !== "2") handleSetOptionDialogOpen(false);
  }

  function showSaveError(description: string) {
    setSaveNotice("idle");
    showToast({ title: t("settings.saveFailed"), description, tone: "error" });
  }

  function requiredFieldErrors() {
    return getRequiredFieldErrors(
      {
        prodNameLa,
        cateUuidFk,
        uniteUuidFk,
        details,
        statusSortFk,
        prodToppingStatus,
        selectedToppings
      },
      t
    );
  }

  function missingCategoryDescription(field: ReturnType<typeof missingCategoryField>) {
    if (field === "store") return t("settings.storeRequired");
    if (field === "group") return t("settings.categoryGroupRequired");
    if (field === "name") return t("settings.categoryNameRequired");
    if (field === "icon") return t("settings.categoryIconRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function saveCategoryFromDialog(formData: FormData) {
    const groupUuid = String(formData.get("group_uuid_fk") ?? "").trim();
    const nameLa = String(formData.get("cate_name_la") ?? "").trim();
    const nameEng = String(formData.get("cate_name_eng") ?? "").trim();
    const icon = String(formData.get("cate_icon") ?? "").trim();
    const missing = missingCategoryField({ storeUuid, groupUuid, nameLa, icon });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: missingCategoryDescription(missing), tone: "error" });
      return;
    }

    try {
      const saved = await saveCategoryRow(buildCategoryPayload({ editing: null, storeUuid, groupUuid, nameLa, nameEng, icon }));
      const refreshed = await loadCategories(language, storeUuid);
      const savedUuid =
        categoryUuid(saved) ||
        findOptionByText(refreshed, { cate_name_la: nameLa, cate_name_eng: nameEng }, CATEGORY_NAME_KEYS, categoryUuid);

      if (savedUuid) setCateUuidFk(savedUuid);
      setCategoryDialogOpen(false);
      showToast({ title: t("settings.saved"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function saveUnitFromDialog(formData: FormData) {
    const nameLa = String(formData.get("unite_name_la") ?? "").trim();
    const nameEng = String(formData.get("unite_name_eng") ?? "").trim();
    const missing = missingUnitField({ nameLa });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.unitNameRequired"), tone: "error" });
      return;
    }

    try {
      const saved = await saveUnitRow(buildUnitPayload({ editing: null, storeUuid, nameLa, nameEng }));
      const refreshed = await loadUnits(language, storeUuid);
      const savedUuid =
        unitUuid(saved) ||
        findOptionByText(refreshed, { unite_name_la: nameLa, unite_name_eng: nameEng }, UNIT_NAME_KEYS, unitUuid);

      if (savedUuid) setUniteUuidFk(savedUuid);
      setUnitDialogOpen(false);
      showToast({ title: t("settings.saved"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function saveSizeFromDialog(formData: FormData) {
    const nameLa = String(formData.get("size_name_la") ?? "").trim();
    const nameEng = String(formData.get("size_name_eng") ?? "").trim();
    const missing = missingSizeField({ nameLa });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.sizeNameRequired"), tone: "error" });
      return;
    }

    try {
      const saved = await saveSizeRow(buildSizePayload({ editing: null, storeUuid, nameLa, nameEng }));
      const [refreshed] = await Promise.all([
        loadSizes(language, storeUuid),
        loadSizesByStatus(storeUuid, Number(statusSortFk), language)
      ]);
      const savedUuid =
        sizeUuid(saved) ||
        findOptionByText(refreshed, { size_name_la: nameLa, size_name_eng: nameEng }, SIZE_NAME_KEYS, sizeUuid);

      if (savedUuid && sizeTargetDetailId) updateDetail(sizeTargetDetailId, { size_uuid_fk: savedUuid });
      setSizeDialogOpen(false);
      setSizeTargetDetailId("");
      showToast({ title: t("settings.saved"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  function openSizeDialog(detailId: string) {
    if (statusSortFk === "2") {
      openSetOptionDialog(detailId);
      return;
    }

    setSizeTargetDetailId(detailId);
    setSizeDialogOpen(true);
  }

  async function submit() {
    setSaveNotice("saving");

    if (isEditing && !prodUuid) return showSaveError("prod_uuid is required");
    if (isEditing && !editing) return showSaveError(t("product.loadFailed"));
    if (isEditing && !editDataReady) return showSaveError(productLoading ? t("product.loading") : t("product.loadFailed"));
    if (!user?.branch_uuid) return showSaveError(t("product.branchRequired"));

    const missingFields = requiredFieldErrors();

    if (missingFields.length) {
      showSaveError(missingFields.join(", "));
      return;
    }

    if (prodStatusImge === "1" && !selectedImage && !rawExistingImage) {
      showSaveError(t("fields.prod_image"));
      return;
    }

    if (prodStatusImge === "2" && !isHexColor(colorValue)) {
      showSaveError(t("product.color"));
      return;
    }

    try {
      const payload = buildSaveProductPayload({
        branchUuid: user.branch_uuid,
        prodCode,
        prodNameLa,
        prodNameEng,
        cateUuidFk,
        uniteUuidFk,
        prodOrderPoint,
        prodNotification,
        statusSortFk,
        prodSetPrice,
        prodStatusImge,
        prodImage: await productImagePayload(),
        details,
        prodToppingStatus,
        selectedToppings
      });
      const updateProdUuid = editing?.prod_uuid ?? prodUuid;
      if (isEditing) payload.prod_uuid = updateProdUuid;

      await saveProduct(payload);
      const nextDefaults = {
        cateUuidFk,
        uniteUuidFk,
        toppingPrices: mergeProductFormToppingPrices(
          storedDefaults.toppingPrices,
          selectedToppings
        )
      };
      const storage = browserProductFormStorage();
      if (storeUuid && storage) {
        writeProductFormDefaults(storage, storeUuid, nextDefaults);
      }
      setStoredDefaults(nextDefaults);

      showToast({ title: t("product.saved"), tone: "success" });
      if (isEditing) {
        router.push("/product");
        return;
      }

      resetCreateForm(nextDefaults);
      scrollProductFormToTop();
      setSaveNotice("saved");
    } catch (error) {
      setSaveNotice("idle");
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    }
  }

  function resetCreateForm(defaults = storedDefaults) {
    setProdCode(generateProdCode());
    setProdNameLa("");
    setProdNameEng("");
    setCateUuidFk(defaults.cateUuidFk);
    setUniteUuidFk(defaults.uniteUuidFk);
    setProdOrderPoint("5");
    setProdNotification("2");
    setStatusSortFk("1");
    setProdSetPrice("0");
    setProdStatusImge("2");
    setSelectedImage(null);
    setCrop(DEFAULT_CROP);
    setColorValue(DEFAULT_COLOR);
    setDetails([emptyDetail("1")]);
    resetToppingSelection();
    handleSetOptionDialogOpen(false);
    resetSetOptionForm();
    setSetOptionSearch("");
    setDeletingSetOptionUuid("");
  }

  const title = isEditing ? t("product.edit") : t("product.formTitle");
  const saveLabel = isEditing ? t("actions.save") : t("product.saveProduct");
  const waitingForEditData = isEditing && !editDataReady;
  const savingProduct = saveNotice === "saving" || saving;
  const saveDisabled = savingProduct || bulkStockSaving || waitingForEditData;
  const saveButtonLabel = waitingForEditData
    ? t("product.loading")
    : savingProduct
      ? t("product.saving")
      : saveNotice === "saved"
        ? t("product.saved")
      : bulkStockSaving
        ? t("common.processing")
        : saveLabel;
  const existingImage = String(editing?.prod_image ?? "");
  const existingSrc =
    existingImage && !existingImage.startsWith("#")
      ? getProductImageUrl(existingImage)
      : rawExistingImage && !rawExistingImage.startsWith("#")
        ? getProductImageUrl(rawExistingImage)
        : "";
  const previewSrc = selectedImagePreview || existingSrc;
  const typeLabel =
    statusSortFk === "2"
      ? t("product.statusSort.foodSet")
      : statusSortFk === "3"
        ? t("product.statusSort.promotion")
        : t("product.statusSort.general");
  const imageLabel = prodStatusImge === "1" ? t("product.statusImge.image") : t("product.statusImge.color");
  const toppingCount = prodToppingStatus === TOPPING_HAS ? selectedToppings.length : 0;
  const validColors = useMemo(() => colors.filter((color) => isHexColor(colorCode(color))), [colors]);
  const categoryOptions = useMemo(
    () => includeSelectedOption(categories, editing, cateUuidFk, categoryUuid),
    [categories, cateUuidFk, editing]
  );
  const groupOptions = useMemo(
    () =>
      groups
        .map((group) => ({ label: groupLabel(group), value: categoryValue(group, "group_uuid") }))
        .filter((option) => option.value),
    [groups]
  );
  const unitOptions = useMemo(
    () => includeSelectedOption(units, editing, uniteUuidFk, unitUuid),
    [editing, uniteUuidFk, units]
  );
  const availableStoredDefaults = useMemo(
    () => productFormDefaultsForOptions(storedDefaults, categoryOptions, unitOptions),
    [categoryOptions, storedDefaults, unitOptions]
  );
  const sizeOptions = useMemo<SizeSelectOption[]>(() => {
    return productFormSizeOptions({
      statusSortFk,
      sizesByStatus: productSizesByStatus,
      sizesByStatusStatus: productSizesByStatusStatus,
      sizes,
      details,
      editingDetails: editing?.details,
    });
  }, [
    details,
    editing?.details,
    productSizesByStatus,
    productSizesByStatusStatus,
    sizes,
    statusSortFk,
  ]);
  const nextDetailStockMode = nextBulkStockMode(detailStockState);
  const detailStockStateLabel =
    detailStockState === "deduct"
      ? t("product.stockBulk.allDeduct")
      : detailStockState === "noDeduct"
        ? t("product.stockBulk.allNoDeduct")
        : t("product.stockBulk.mixed");
  const detailStockStateClass =
    detailStockState === "deduct"
      ? "bg-primary/10 text-primary"
      : detailStockState === "noDeduct"
        ? "bg-secondary text-secondary-foreground"
        : "bg-muted text-muted-foreground";
  const detailStockActionLabel =
    detailStockState === "deduct" ? t("product.stockBulk.noDeductAll") : t("product.stockBulk.deductAll");
  const productTypeChoices = [
    {
      value: "1" as const,
      label: t("product.statusSort.general"),
      hint: t("product.choiceHints.general")
    },
    {
      value: "2" as const,
      label: t("product.statusSort.foodSet"),
      hint: t("product.choiceHints.foodSet")
    },
    {
      value: "3" as const,
      label: t("product.statusSort.promotion"),
      hint: t("product.choiceHints.promotion")
    }
  ];
  const imageModeChoices = [
    {
      value: "1" as const,
      label: t("product.statusImge.image"),
      hint: t("product.choiceHints.image")
    },
    {
      value: "2" as const,
      label: t("product.statusImge.color"),
      hint: t("product.choiceHints.color")
    }
  ];
  const toppingModeChoices = [
    {
      value: TOPPING_NONE,
      label: t("product.topping.no"),
      hint: t("product.choiceHints.noTopping")
    },
    {
      value: TOPPING_HAS,
      label: t("product.topping.has"),
      hint: t("product.choiceHints.hasTopping")
    }
  ];
  const detailModeHint =
    statusSortFk === "2"
      ? t("product.detailModeHints.foodSet")
      : statusSortFk === "3"
        ? t("product.detailModeHints.promotion")
        : t("product.detailModeHints.general");
  const hasValidDetails =
    details.length > 0 &&
    details.every(
      (detail) =>
        detail.size_uuid_fk &&
        detail.pro_detail_bprice.trim() &&
        (statusSortFk === "2" || detail.pro_detail_sprice.trim())
    );
  const hasProductMedia = prodStatusImge === "2" ? isHexColor(colorValue) : Boolean(selectedImage || rawExistingImage);
  const hasToppingSetup = prodToppingStatus === TOPPING_NONE || selectedToppings.length > 0;
  const requiredChecks = [
    { label: t("fields.nameLa"), done: Boolean(prodNameLa.trim()) },
    { label: t("nav.category"), done: Boolean(cateUuidFk) },
    { label: t("nav.unit"), done: Boolean(uniteUuidFk) },
    { label: t("product.sections.image"), done: hasProductMedia },
    { label: t("product.sections.details"), done: hasValidDetails },
    { label: t("product.sections.toppings"), done: hasToppingSetup }
  ];
  const completedChecks = requiredChecks.filter((item) => item.done).length;
  const readyToSave = completedChecks === requiredChecks.length && !saveDisabled;

  const editingCategoryUuid = useMemo(() => {
    if (!editing) return "";
    return productCategoryUuid(editing) || findOptionByText(categoryOptions, editing, CATEGORY_NAME_KEYS, categoryUuid);
  }, [categoryOptions, editing]);
  const editingUnitUuid = useMemo(() => {
    if (!editing) return "";
    return productUnitUuid(editing) || findOptionByText(unitOptions, editing, UNIT_NAME_KEYS, unitUuid);
  }, [editing, unitOptions]);

  useEffect(() => {
    if (!editing || cateUuidFk || !editingCategoryUuid) return;
    setCateUuidFk(editingCategoryUuid);
  }, [cateUuidFk, editing, editingCategoryUuid]);

  useEffect(() => {
    if (!editing || uniteUuidFk || !editingUnitUuid) return;
    setUniteUuidFk(editingUnitUuid);
  }, [editing, editingUnitUuid, uniteUuidFk]);

  useEffect(() => {
    if (isEditing && (!editing || editingCategoryUuid)) return;
    if (cateUuidFk || !availableStoredDefaults.cateUuidFk) return;
    setCateUuidFk(availableStoredDefaults.cateUuidFk);
  }, [availableStoredDefaults.cateUuidFk, cateUuidFk, editing, editingCategoryUuid, isEditing]);

  useEffect(() => {
    if (isEditing && (!editing || editingUnitUuid)) return;
    if (uniteUuidFk || !availableStoredDefaults.uniteUuidFk) return;
    setUniteUuidFk(availableStoredDefaults.uniteUuidFk);
  }, [availableStoredDefaults.uniteUuidFk, editing, editingUnitUuid, isEditing, uniteUuidFk]);

  return {
    t,
    title,
    saveNotice,
    saveDisabled,
    saveButtonLabel,
    existingSrc,
    previewSrc,
    typeLabel,
    imageLabel,
    toppingCount,
    validColors,
    selectedToppingMap,
    categoryOptions,
    groupOptions,
    unitOptions,
    sizeOptions,
    setOptionOptions,
    filteredSetOptionOptions,
    nextDetailStockMode,
    detailStockStateLabel,
    detailStockStateClass,
    detailStockActionLabel,
    toppingOptions,
    filteredToppingOptions,
    productTypeChoices,
    imageModeChoices,
    toppingModeChoices,
    detailModeHint,
    selectedToppingBadges,
    requiredChecks,
    completedChecks,
    readyToSave,
    prodCode,
    setProdCode,
    prodNameLa,
    setProdNameLa,
    prodNameEng,
    setProdNameEng,
    cateUuidFk,
    setCateUuidFk,
    uniteUuidFk,
    setUniteUuidFk,
    prodOrderPoint,
    setProdOrderPoint,
    prodNotification,
    setProdNotification,
    statusSortFk,
    prodSetPrice,
    setProdSetPrice,
    prodStatusImge,
    setProdStatusImge,
    selectedImage,
    setSelectedImage,
    crop,
    setCrop,
    colorValue,
    setColorValue,
    colorChoice,
    setColorChoice,
    details,
    bulkStockSaving,
    prodToppingStatus,
    setProdToppingStatus,
    categoryDialogOpen,
    setCategoryDialogOpen,
    unitDialogOpen,
    setUnitDialogOpen,
    sizeDialogOpen,
    setSizeDialogOpen,
    selectedToppings,
    toppingDialogOpen,
    setToppingDialogOpen,
    newToppingNameLa,
    setNewToppingNameLa,
    newToppingNameEng,
    setNewToppingNameEng,
    newToppingPrice,
    setNewToppingPrice,
    toppingSearch,
    setToppingSearch,
    editingToppingUuid,
    deletingToppingUuid,
    setDeletingToppingUuid,
    setOptionDialogOpen,
    handleSetOptionDialogOpen,
    setOptionNameLa,
    setSetOptionNameLa,
    setOptionNameEng,
    setSetOptionNameEng,
    setOptionSearch,
    setSetOptionSearch,
    editingSetOptionUuid,
    deletingSetOptionUuid,
    setDeletingSetOptionUuid,
    setOptionSaving,
    language,
    storeUuid,
    saving: savingProduct,
    categorySaving,
    unitSaving,
    sizeSaving,
    toppingSaving,
    colors,
    submit,
    addDetail,
    updateDetail,
    updateAllDetailStockModes,
    removeDetail,
    saveCategoryFromDialog,
    saveUnitFromDialog,
    saveSizeFromDialog,
    openSizeDialog,
    toggleTopping,
    updateToppingPrice,
    resetNewToppingForm,
    editTopping,
    saveToppingFromDialog,
    deleteToppingFromDialog,
    resetSetOptionForm,
    editSetOption,
    saveSetOptionFromDialog,
    deleteSetOptionFromDialog,
    changeStatusSort,
  };
}

export type ProductFormWorkflow = ReturnType<typeof useProductFormWorkflow>;
