"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addPublicSearchHistoryItem,
  clearPublicSearchHistory,
  publicSearchHistoryKey,
  readPublicSearchHistory,
  writePublicSearchHistory,
} from "@/features/public-pos/utils";

export function usePublicSearch({
  branchUuid,
  lang,
}: {
  branchUuid?: string | null;
  lang: string;
}) {
  const [searchText, setSearchText] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [searchRun, setSearchRun] = useState(0);
  const suppressSearchOpenUntil = useRef(0);
  const searchHistoryKey = useMemo(
    () => publicSearchHistoryKey(branchUuid, lang),
    [branchUuid, lang],
  );

  useEffect(() => {
    setSearchHistory(readPublicSearchHistory(searchHistoryKey));
  }, [searchHistoryKey]);

  const saveSearchHistory = useCallback(
    (query: string) => {
      setSearchHistory((current) => {
        const nextHistory = addPublicSearchHistoryItem(current, query);
        writePublicSearchHistory(searchHistoryKey, nextHistory);
        return nextHistory;
      });
    },
    [searchHistoryKey],
  );

  const runSearch = useCallback(
    (value: string) => {
      const query = value.trim();
      setSearchText(query);
      setSearchDraft(query);
      setSubmittedSearch(query);
      if (query) saveSearchHistory(query);
      setSearchOpen(false);
      setSearchRun((current) => current + 1);
    },
    [saveSearchHistory],
  );

  const openSearchSheet = useCallback(() => {
    if (Date.now() < suppressSearchOpenUntil.current) return;

    setSearchDraft(searchText);
    setSearchOpen(true);
  }, [searchText]);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      openSearchSheet();
    },
    [openSearchSheet],
  );

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    clearPublicSearchHistory(searchHistoryKey);
  }, [searchHistoryKey]);

  const handleSearchSheetSubmit = useCallback(() => {
    runSearch(searchDraft);
  }, [runSearch, searchDraft]);

  const handleSearchHistorySelect = useCallback(
    (query: string) => {
      runSearch(query);
    },
    [runSearch],
  );

  const handleSearchOpenChange = useCallback(
    (open: boolean) => {
      setSearchOpen(open);
      if (open) {
        setSearchDraft(searchText);
        return;
      }

      suppressSearchOpenUntil.current = Date.now() + 180;
    },
    [searchText],
  );

  const handleSearchDraftChange = useCallback((value: string) => {
    setSearchDraft(value);
  }, []);

  return {
    searchText,
    searchDraft,
    searchOpen,
    searchHistory,
    submittedSearch,
    searchRun,
    openSearchSheet,
    handleSearchSubmit,
    clearSearchHistory,
    handleSearchSheetSubmit,
    handleSearchHistorySelect,
    handleSearchOpenChange,
    handleSearchDraftChange,
  };
}
