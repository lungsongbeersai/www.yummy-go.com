"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_CROP,
  cropImageFile,
  type CropState,
} from "@/features/settings/shared/settings-image-crop";
import type { Category } from "@/services/category";
import type { Color } from "@/services/color";
import { getProductImageUrl, type Product } from "@/services/product";
import type { Size } from "@/services/size";
import type { Topping } from "@/services/topping";
import type { Unit } from "@/services/unit";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useProductStore } from "@/stores/product-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { useToppingStore } from "@/stores/topping-store";
import type {
  BinaryFlag,
  DetailRow,
  SizeSelectOption,
  StatusSortFk,
  ToppingSelection,
} from "./product-form-types";
import {
  CATEGORY_NAME_KEYS,
  CUSTOM_COLOR_VALUE,
  DEFAULT_COLOR,
  EMPTY_CATEGORIES,
  EMPTY_COLORS,
  EMPTY_SIZES,
  EMPTY_TOPPINGS,
  EMPTY_UNITS,
  TOPPING_HAS,
  TOPPING_NAME_KEYS,
  TOPPING_NONE,
  UNIT_NAME_KEYS,
  binaryFlag,
  buildSaveProductPayload,
  categoryUuid,
  colorCode,
  detailFromProduct,
  detailSizeUuid,
  detailStockSummary,
  emptyDetail,
  findOptionByText,
  findToppingUuidByName,
  generateProdCode,
  hasEditableProductData,
  includeSelectedOption,
  isHexColor,
  nextBulkStockMode,
  normalizeDetailsForStatus,
  normalizedText,
  productCategoryUuid,
  productColorValue,
  productHasToppings,
  productHydrationKey,
  productImageStatus,
  productToppingName,
  productToppingUuid,
  productToppingsFromRows,
  productUnitUuid,
  rawProductImage,
  requiredFieldErrors as getRequiredFieldErrors,
  selectedToppingBadges as buildSelectedToppingBadges,
  sizeUuid,
  textValues,
  toppingUuid,
  unitUuid,
} from "./product-form-utils";

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
  const rows = useProductStore((state) => state.rows);
  const productLoading = useProductStore((state) => state.loading);
  const productSizesByStatus = useProductStore((state) => state.sizesByStatus);
  const saving = useProductStore((state) => state.saving);
  const saveProduct = useProductStore((state) => state.save);
  const loadProducts = useProductStore((state) => state.load);
  const loadSizesByStatus = useProductStore((state) => state.loadSizesByStatus);
  const updateDetailsStock = useProductStore((state) => state.updateDetailsStock);
  const categories = (useReferenceStore((state) => state.options.categories) ?? EMPTY_CATEGORIES) as Category[];
  const colors = (useReferenceStore((state) => state.options.colors) ?? EMPTY_COLORS) as Color[];
  const units = (useReferenceStore((state) => state.options.units) ?? EMPTY_UNITS) as Unit[];
  const sizes = (useReferenceStore((state) => state.options.sizes) ?? EMPTY_SIZES) as Size[];
  const toppings = (useReferenceStore((state) => state.options.toppings) ?? EMPTY_TOPPINGS) as Topping[];
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const loadColors = useReferenceStore((state) => state.loadColors);
  const loadUnits = useReferenceStore((state) => state.loadUnits);
  const loadSizes = useReferenceStore((state) => state.loadSizes);
  const loadToppings = useReferenceStore((state) => state.loadToppings);
  const createToppingRow = useToppingStore((state) => state.save);
  const deleteToppingRow = useToppingStore((state) => state.remove);
  const toppingSaving = useToppingStore((state) => state.saving);

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
  const [statusSortFk, setStatusSortFk] = useState<StatusSortFk>("1");
  const [prodSetPrice, setProdSetPrice] = useState("0");
  const [prodStatusImge, setProdStatusImge] = useState<BinaryFlag>("2");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState("");
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [colorValue, setColorValue] = useState(DEFAULT_COLOR);
  const [colorChoice, setColorChoice] = useState(CUSTOM_COLOR_VALUE);
  const [details, setDetails] = useState<DetailRow[]>(() => [emptyDetail("1")]);
  const [bulkStockSaving, setBulkStockSaving] = useState(false);
  const [prodToppingStatus, setProdToppingStatus] = useState<BinaryFlag>(TOPPING_NONE);
  const [selectedToppings, setSelectedToppings] = useState<ToppingSelection[]>([]);
  const [editLoadKey, setEditLoadKey] = useState("");
  const [toppingDialogOpen, setToppingDialogOpen] = useState(false);
  const [newToppingNameLa, setNewToppingNameLa] = useState("");
  const [newToppingNameEng, setNewToppingNameEng] = useState("");
  const [newToppingPrice, setNewToppingPrice] = useState("0");
  const [toppingSearch, setToppingSearch] = useState("");
  const [editingToppingUuid, setEditingToppingUuid] = useState("");
  const [deletingToppingUuid, setDeletingToppingUuid] = useState("");
  const [hiddenToppingUuids, setHiddenToppingUuids] = useState<string[]>([]);

  useEffect(() => {
    if (!storeUuid) return;
    void Promise.all([
      loadCategories(language, storeUuid),
      loadColors(),
      loadUnits(language, storeUuid),
      loadSizes(language, storeUuid),
      loadToppings(language, storeUuid)
    ]).catch((error) => {
      showToast({
        title: t("settings.loadFailed", { title: t("product.title") }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    });
  }, [language, loadCategories, loadColors, loadSizes, loadToppings, loadUnits, showToast, storeUuid, t]);

  useEffect(() => {
    if (!storeUuid) return;
    void loadSizesByStatus(storeUuid, Number(statusSortFk), language).catch((error) => {
      showToast({
        title: t("settings.loadFailed", { title: t("settings.modules.size.title") }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    });
  }, [language, loadSizesByStatus, showToast, statusSortFk, storeUuid, t]);

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
    if (!selectedImage) {
      setSelectedImagePreview("");
      return;
    }

    const url = URL.createObjectURL(selectedImage);
    setSelectedImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

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
    setProdToppingStatus(productHasToppings(editing) ? TOPPING_HAS : TOPPING_NONE);
    if (editing.details?.length) {
      setDetails(editing.details.map((detail) => detailFromProduct(detail, nextStatus)));
    }
    setSelectedToppings(productToppingsFromRows(editing.toppings, toppings));
  }, [editing, editingHydrationKey, toppings]);

  function addDetail() {
    setDetails((current) => [...current, emptyDetail(statusSortFk)]);
  }

  function updateDetail(id: string, patch: Partial<DetailRow>) {
    setDetails((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function updateAllDetailStockModes(nextStockMode: BinaryFlag) {
    const previousDetails = details;
    const nextDetails = previousDetails.map((row) => ({ ...row, pro_detail_stock: nextStockMode }));
    const stockModes = previousDetails
      .map((row) => ({
        pro_detail_uuid: row.pro_detail_uuid.trim(),
        pro_detail_stock: Number(nextStockMode)
      }))
      .filter((row) => row.pro_detail_uuid);

    setDetails(nextDetails);

    if (!isEditing || !stockModes.length) return;

    setBulkStockSaving(true);
    try {
      await updateDetailsStock(stockModes);
      showToast({ title: t("product.saved"), tone: "success" });
    } catch (error) {
      const previousStockById = new Map(previousDetails.map((row) => [row.id, row.pro_detail_stock]));
      setDetails((current) =>
        current.map((row) => ({
          ...row,
          pro_detail_stock: previousStockById.get(row.id) ?? row.pro_detail_stock
        }))
      );
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    } finally {
      setBulkStockSaving(false);
    }
  }

  function removeDetail(id: string) {
    setDetails((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
  }

  function toggleTopping(uuid: string, checked: boolean) {
    setSelectedToppings((current) => {
      if (checked) {
        if (current.some((row) => row.topping_uuid_fk === uuid)) return current;
        return [...current, { topping_uuid_fk: uuid, topping_price: "0" }];
      }
      return current.filter((row) => row.topping_uuid_fk !== uuid);
    });
  }

  function updateToppingPrice(uuid: string, price: string) {
    setSelectedToppings((current) =>
      current.map((row) => (row.topping_uuid_fk === uuid ? { ...row, topping_price: price } : row))
    );
  }

  function resetNewToppingForm() {
    setEditingToppingUuid("");
    setNewToppingNameLa("");
    setNewToppingNameEng("");
    setNewToppingPrice("0");
  }

  function selectSavedTopping(uuid: string, price: string, forceSelect: boolean) {
    if (!uuid) return;
    if (forceSelect) setProdToppingStatus(TOPPING_HAS);

    setSelectedToppings((current) => {
      const nextPrice = price.trim() || "0";
      const exists = current.some((row) => row.topping_uuid_fk === uuid);
      if (!forceSelect && !exists) return current;
      if (exists) {
        return current.map((row) => (row.topping_uuid_fk === uuid ? { ...row, topping_price: nextPrice } : row));
      }
      return [...current, { topping_uuid_fk: uuid, topping_price: nextPrice }];
    });
  }

  function editTopping(topping: Topping) {
    const uuid = toppingUuid(topping);
    if (!uuid) return;

    setEditingToppingUuid(uuid);
    setNewToppingNameLa(String(topping.topping_name_la ?? productToppingName(topping) ?? ""));
    setNewToppingNameEng(String(topping.topping_name_eng ?? ""));
    setNewToppingPrice(selectedToppingMap.get(uuid)?.topping_price ?? "0");
  }

  async function saveToppingFromDialog() {
    const nameLa = newToppingNameLa.trim();
    const nameEng = newToppingNameEng.trim() || nameLa;

    if (!storeUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    if (!nameLa) {
      showToast({ title: t("settings.saveFailed"), description: t("fields.nameLa"), tone: "error" });
      return;
    }

    try {
      const saved = await createToppingRow({
        ...(editingToppingUuid ? { topping_uuid: editingToppingUuid } : {}),
        store_uuid_fk: storeUuid,
        topping_name_la: nameLa,
        topping_name_eng: nameEng
      });
      const refreshed = await loadToppings(language, storeUuid);
      const savedUuid = editingToppingUuid || toppingUuid(saved) || findToppingUuidByName(refreshed, nameLa, nameEng);

      setHiddenToppingUuids((current) => current.filter((uuid) => uuid !== savedUuid));
      selectSavedTopping(savedUuid, newToppingPrice, !editingToppingUuid);

      showToast({ title: t("settings.saved"), tone: "success" });
      resetNewToppingForm();
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function deleteToppingFromDialog(uuid: string) {
    if (!uuid) return;

    try {
      await deleteToppingRow(uuid);
      setHiddenToppingUuids((current) => (current.includes(uuid) ? current : [...current, uuid]));
      setSelectedToppings((current) => current.filter((row) => row.topping_uuid_fk !== uuid));
      if (editingToppingUuid === uuid) resetNewToppingForm();
      if (storeUuid) await loadToppings(language, storeUuid);
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    } finally {
      setDeletingToppingUuid("");
    }
  }

  function changeStatusSort(value: StatusSortFk) {
    setDetails((current) => normalizeDetailsForStatus(current, value, statusSortFk));
    setStatusSortFk(value);
    if (value !== "2") setProdSetPrice("0");
  }

  function showSaveError(description: string) {
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

  async function productImagePayload() {
    if (prodStatusImge === "2") return colorValue;
    if (selectedImage) return cropImageFile(selectedImage, crop, t("settings.storeBranch.imageLoadFailed"));
    return rawExistingImage && !rawExistingImage.startsWith("#") ? rawExistingImage : undefined;
  }

  async function submit() {
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
      showToast({ title: t("product.saved"), tone: "success" });
      router.push("/product");
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    }
  }

  const title = isEditing ? t("product.edit") : t("product.formTitle");
  const saveLabel = isEditing ? t("actions.save") : t("product.saveProduct");
  const waitingForEditData = isEditing && !editDataReady;
  const saveDisabled = saving || bulkStockSaving || waitingForEditData;
  const saveButtonLabel = waitingForEditData ? t("product.loading") : saving ? t("common.processing") : saveLabel;
  const rawExistingImage = rawProductImage(editing);
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
  const selectedToppingMap = useMemo(
    () => new Map(selectedToppings.map((row) => [row.topping_uuid_fk, row])),
    [selectedToppings]
  );
  const categoryOptions = useMemo(
    () => includeSelectedOption(categories, editing, cateUuidFk, categoryUuid),
    [categories, cateUuidFk, editing]
  );
  const unitOptions = useMemo(
    () => includeSelectedOption(units, editing, uniteUuidFk, unitUuid),
    [editing, uniteUuidFk, units]
  );
  const sizeOptions = useMemo<SizeSelectOption[]>(() => {
    const baseSizes: SizeSelectOption[] = productSizesByStatus.length ? productSizesByStatus : sizes;
    const rows = baseSizes.filter((size) => sizeUuid(size));
    const seen = new Set(rows.map((size) => sizeUuid(size)));
    const missing = details
      .map((detail) => detail.size_uuid_fk)
      .filter((uuid) => uuid && !seen.has(uuid))
      .map((uuid) => editing?.details?.find((detail) => detailSizeUuid(detail) === uuid))
      .filter((detail): detail is NonNullable<Product["details"]>[number] => Boolean(detail));

    return missing.length ? [...rows, ...missing] : rows;
  }, [details, editing?.details, productSizesByStatus, sizes]);
  const detailStockState = useMemo(() => detailStockSummary(details), [details]);
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
  const toppingOptions = useMemo(() => {
    const hidden = new Set(hiddenToppingUuids);
    const rows = toppings.filter((topping) => {
      const uuid = toppingUuid(topping);
      return uuid && !hidden.has(uuid);
    });
    const seen = new Set(rows.map((topping) => toppingUuid(topping)));
    const missing =
      editing?.toppings?.filter((topping) => {
        const uuid = productToppingUuid(topping, rows);
        return uuid && !seen.has(uuid) && !hidden.has(uuid);
      }) ?? [];

    return missing.length ? [...rows, ...(missing as Topping[])] : rows;
  }, [editing?.toppings, hiddenToppingUuids, toppings]);
  const filteredToppingOptions = useMemo(() => {
    const query = normalizedText(toppingSearch);
    if (!query) return toppingOptions;
    return toppingOptions.filter((topping) =>
      textValues(topping, TOPPING_NAME_KEYS).some((value) => value.includes(query))
    );
  }, [toppingOptions, toppingSearch]);
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
  const selectedToppingBadges = useMemo(
    () => buildSelectedToppingBadges(selectedToppings, toppingOptions, language),
    [language, selectedToppings, toppingOptions]
  );
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

  useEffect(() => {
    if (!editing || cateUuidFk || !categoryOptions.length) return;
    const uuid = findOptionByText(categoryOptions, editing, CATEGORY_NAME_KEYS, categoryUuid);
    if (uuid) setCateUuidFk(uuid);
  }, [categoryOptions, cateUuidFk, editing]);

  useEffect(() => {
    if (!editing || uniteUuidFk || !unitOptions.length) return;
    const uuid = findOptionByText(unitOptions, editing, UNIT_NAME_KEYS, unitUuid);
    if (uuid) setUniteUuidFk(uuid);
  }, [editing, unitOptions, uniteUuidFk]);

  useEffect(() => {
    if (!editing?.toppings?.length || !toppingOptions.length) return;

    const resolved = editing.toppings
      .map((row) => ({
        topping_uuid_fk: productToppingUuid(row, toppingOptions),
        topping_price: String(row.topping_price ?? 0)
      }))
      .filter((row) => row.topping_uuid_fk);

    if (!resolved.length) return;

    setSelectedToppings((current) => {
      const selectedIds = new Set(current.map((row) => row.topping_uuid_fk));
      const missing = resolved.filter((row) => !selectedIds.has(row.topping_uuid_fk));
      if (!current.length) return resolved;
      return missing.length ? [...current, ...missing] : current;
    });
  }, [editing, toppingOptions]);

  return {
    t,
    title,
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
    unitOptions,
    sizeOptions,
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
    language,
    storeUuid,
    saving,
    toppingSaving,
    colors,
    submit,
    addDetail,
    updateDetail,
    updateAllDetailStockModes,
    removeDetail,
    toggleTopping,
    updateToppingPrice,
    resetNewToppingForm,
    editTopping,
    saveToppingFromDialog,
    deleteToppingFromDialog,
    changeStatusSort,
  };
}

export type ProductFormWorkflow = ReturnType<typeof useProductFormWorkflow>;
