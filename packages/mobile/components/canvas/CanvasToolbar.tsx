import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from "react-native";
import { useState } from "react";
import {
  MagnifyingGlassIcon, SortAscendingIcon, SquaresFourIcon,
  ListBulletsIcon, GridFourIcon, FunnelIcon, ArrowsClockwiseIcon,
  StackIcon,
} from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import type { SortBy, ViewMode } from "../../store/canvasStore";
import { FILTERS } from "./canvasUtils";
import CanvasFiltersSheet from "./CanvasFiltersSheet";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: theme.highlightBG,
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 14, paddingVertical: 10 },
    compactRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.highlightBG,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    expandedSearch: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.highlightBG,
      borderRadius: 10,
      paddingHorizontal: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filtersScroll: { flexGrow: 0, alignSelf: "flex-start", maxHeight: 44 },
    filtersContent: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      gap: 8,
      paddingBottom: 8,
      height: 36,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBG,
    },
    filterChipActive: { backgroundColor: theme.success, borderColor: theme.success },
    filterChipText: { color: theme.textSupporting, fontSize: 13, fontWeight: "500" },
    filterChipTextActive: { color: theme.appBG, fontWeight: "700" },
    tagChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 100,
      backgroundColor: theme.highlightBG,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tagChipActive: { borderColor: theme.success, backgroundColor: theme.success + "22" },
    tagChipText: { color: theme.placeholderText, fontSize: 12 },
    tagChipTextActive: { color: theme.success, fontWeight: "700" },
    toolbarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    sortBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.highlightBG,
    },
    sortText: { color: theme.textSupporting, fontSize: 12, fontWeight: "600" },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.highlightBG,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionBtnActive: { borderColor: theme.success, backgroundColor: theme.success + "22" },
    actionText: { color: theme.textSupporting, fontSize: 12, fontWeight: "600" },
    actionTextActive: { color: theme.success },
    viewToggle: { flexDirection: "row", gap: 4, backgroundColor: theme.highlightBG, borderRadius: 8, padding: 3 },
    viewBtn: { padding: 6, borderRadius: 6 },
    viewBtnActive: { backgroundColor: theme.cardBG },
    compactActions: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" },
  });
}

const SORT_LABELS: Record<SortBy, string> = {
  newest: "Newest",
  oldest: "Oldest",
  most_ideas: "Most ideas",
};

type Props = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filter: string;
  onFilterChange: (f: string) => void;
  tagFilter: string | null;
  onTagFilterChange: (t: string | null) => void;
  availableTags: string[];
  sortBy: SortBy;
  onSortChange: (s: SortBy) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  compact?: boolean;
  showClusters?: boolean;
  onToggleClusters?: () => void;
  onTidy?: () => void;
};

export default function CanvasToolbar({
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  tagFilter,
  onTagFilterChange,
  availableTags,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  compact = false,
  showClusters = false,
  onToggleClusters,
  onTidy,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sortCycle: SortBy[] = ["newest", "oldest", "most_ideas"];
  const nextSort = () => {
    const idx = sortCycle.indexOf(sortBy);
    onSortChange(sortCycle[(idx + 1) % sortCycle.length]);
  };

  const hasActiveFilters = filter !== "all" || tagFilter !== null;

  const viewToggle = (
    <View style={styles.viewToggle}>
      {([
        { mode: "feed" as ViewMode, Icon: ListBulletsIcon },
        { mode: "grid" as ViewMode, Icon: GridFourIcon },
        { mode: "board" as ViewMode, Icon: SquaresFourIcon },
      ]).map(({ mode, Icon }) => (
        <TouchableOpacity
          key={mode}
          style={[styles.viewBtn, viewMode === mode && styles.viewBtnActive]}
          onPress={() => onViewModeChange(mode)}
        >
          <Icon
            size={18}
            color={viewMode === mode ? theme.success : theme.placeholderText}
            weight={viewMode === mode ? "fill" : "regular"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  if (compact) {
    return (
      <>
        <View style={styles.compactRow}>
          {searchExpanded ? (
            <View style={styles.expandedSearch}>
              <MagnifyingGlassIcon size={16} color={theme.placeholderText} />
              <TextInput
                style={{ flex: 1, color: theme.text, fontSize: 14, paddingVertical: 8 }}
                placeholder="Search…"
                placeholderTextColor={theme.placeholderText}
                value={searchQuery}
                onChangeText={onSearchChange}
                autoFocus
                autoCorrect={false}
              />
            </View>
          ) : (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setSearchExpanded(true)}>
              <MagnifyingGlassIcon size={18} color={theme.textSupporting} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.sortBtn} onPress={nextSort}>
            <SortAscendingIcon size={16} color={theme.textSupporting} />
            <Text style={styles.sortText}>{SORT_LABELS[sortBy]}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, hasActiveFilters && { borderColor: theme.success }]}
            onPress={() => setFiltersOpen(true)}
          >
            <FunnelIcon size={18} color={hasActiveFilters ? theme.success : theme.textSupporting} />
          </TouchableOpacity>
          <View style={styles.compactActions}>
            {onTidy ? (
              <TouchableOpacity style={styles.actionBtn} onPress={onTidy}>
                <ArrowsClockwiseIcon size={14} color={theme.textSupporting} />
                <Text style={styles.actionText}>Tidy</Text>
              </TouchableOpacity>
            ) : null}
            {onToggleClusters ? (
              <TouchableOpacity
                style={[styles.actionBtn, showClusters && styles.actionBtnActive]}
                onPress={onToggleClusters}
              >
                <StackIcon size={14} color={showClusters ? theme.success : theme.textSupporting} />
                <Text style={[styles.actionText, showClusters && styles.actionTextActive]}>Groups</Text>
              </TouchableOpacity>
            ) : null}
            {viewToggle}
          </View>
        </View>
        <CanvasFiltersSheet
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filter={filter}
          onFilterChange={onFilterChange}
          tagFilter={tagFilter}
          onTagFilterChange={onTagFilterChange}
          availableTags={availableTags}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.searchRow}>
        <MagnifyingGlassIcon size={18} color={theme.placeholderText} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search inspirations…"
          placeholderTextColor={theme.placeholderText}
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCorrect={false}
        />
      </View>

      <View style={styles.toolbarRow}>
        <TouchableOpacity style={styles.sortBtn} onPress={nextSort}>
          <SortAscendingIcon size={16} color={theme.textSupporting} />
          <Text style={styles.sortText}>{SORT_LABELS[sortBy]}</Text>
        </TouchableOpacity>
        {viewToggle}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => onFilterChange(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {availableTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {availableTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, tagFilter === tag && styles.tagChipActive]}
              onPress={() => onTagFilterChange(tagFilter === tag ? null : tag)}
            >
              <Text style={[styles.tagChipText, tagFilter === tag && styles.tagChipTextActive]}>
                #{tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </>
  );
}
