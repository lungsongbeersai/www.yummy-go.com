import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteDeportment,
  getAllDeportments,
  saveDeportment
} from "@/services/deportment";
import {
  deletePosition,
  getAllPositions,
  savePosition
} from "@/services/position";
import { useUserTaxonomyStore } from "@/stores/user-taxonomy-store";

vi.mock("@/services/deportment", () => ({
  deleteDeportment: vi.fn(),
  getAllDeportments: vi.fn(),
  saveDeportment: vi.fn()
}));

vi.mock("@/services/position", () => ({
  deletePosition: vi.fn(),
  getAllPositions: vi.fn(),
  savePosition: vi.fn()
}));

const deleteDeportmentMock = vi.mocked(deleteDeportment);
const deletePositionMock = vi.mocked(deletePosition);
const getAllDeportmentsMock = vi.mocked(getAllDeportments);
const getAllPositionsMock = vi.mocked(getAllPositions);
const saveDeportmentMock = vi.mocked(saveDeportment);
const savePositionMock = vi.mocked(savePosition);

describe("user taxonomy store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserTaxonomyStore.getState().reset();
  });

  it("loads all positions so inactive records remain manageable", async () => {
    const positions = [
      { position_uuid: "position-1", position_name: "Cashier", position_active: 1 },
      { position_uuid: "position-2", position_name: "Old role", position_active: 2 }
    ];
    getAllPositionsMock.mockResolvedValue(positions);

    await useUserTaxonomyStore.getState().load("position", "eng");

    expect(getAllPositionsMock).toHaveBeenCalledWith("eng");
    expect(useUserTaxonomyStore.getState().positions).toEqual(positions);
  });

  it("creates a position and refreshes its management list", async () => {
    savePositionMock.mockResolvedValue({ position_uuid: "position-3" });
    getAllPositionsMock.mockResolvedValue([
      { position_uuid: "position-3", position_name: "Manager", position_active: 1 }
    ]);

    await expect(useUserTaxonomyStore.getState().save("position", {
      active: 1,
      code: "manager",
      nameEng: "Manager",
      nameLa: "ຜູ້ຈັດການ"
    }, "la")).resolves.toBe("position-3");

    expect(savePositionMock).toHaveBeenCalledWith({
      position_uuid: undefined,
      position_active: 1,
      position_code: "manager",
      position_name_eng: "Manager",
      position_name_la: "ຜູ້ຈັດການ"
    });
    expect(useUserTaxonomyStore.getState().positions).toHaveLength(1);
  });

  it("updates a department with its existing UUID", async () => {
    saveDeportmentMock.mockResolvedValue({ deportment_uuid: "deportment-1" });
    getAllDeportmentsMock.mockResolvedValue([
      { deportment_uuid: "deportment-1", deportment_name: "Service", deportment_active: 2 }
    ]);

    await useUserTaxonomyStore.getState().save("deportment", {
      uuid: "deportment-1",
      active: 2,
      code: "SERVICE",
      nameEng: "Service",
      nameLa: "ບໍລິການ"
    }, "la");

    expect(saveDeportmentMock).toHaveBeenCalledWith(expect.objectContaining({
      deportment_uuid: "deportment-1",
      deportment_active: 2
    }));
  });

  it("deletes an unused record and refreshes the matching list", async () => {
    deletePositionMock.mockResolvedValue(undefined);
    getAllPositionsMock.mockResolvedValue([]);

    await useUserTaxonomyStore.getState().remove("position", "position-1", "la");

    expect(deletePositionMock).toHaveBeenCalledWith("position-1");
    expect(useUserTaxonomyStore.getState()).toMatchObject({ deletingId: "", positions: [] });
    expect(deleteDeportmentMock).not.toHaveBeenCalled();
  });
});
