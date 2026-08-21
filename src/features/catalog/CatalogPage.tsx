import { Edit, PackagePlus, Plus, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  ArticleInput,
  CatalogArticle,
  CatalogCategory,
  CatalogSnapshot,
  CategoryInput
} from "@app/services/catalog";
import { useAuth } from "@features/auth";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  useToast
} from "@shared/ui";

interface CatalogPageProps {
  catalogService: {
    list(this: void): Promise<CatalogSnapshot>;
    createCategory(this: void, input: CategoryInput): Promise<CatalogCategory>;
    updateCategory(
      this: void,
      id: string,
      input: CategoryInput
    ): Promise<CatalogCategory>;
    deleteCategory(this: void, id: string): Promise<void>;
    createArticle(this: void, input: ArticleInput): Promise<CatalogArticle>;
    updateArticle(
      this: void,
      id: string,
      input: ArticleInput
    ): Promise<CatalogArticle>;
    deleteArticle(this: void, id: string): Promise<void>;
  };
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; catalog: CatalogSnapshot }
  | { status: "error"; error: string };

interface CategoryDraft {
  id?: string;
  name: string;
  description: string;
}

interface ArticleDraft {
  id?: string;
  name: string;
  categoryId: string;
  sku: string;
  description: string;
  unit: string;
  price: string;
  active: boolean;
}

const emptyCategoryDraft: CategoryDraft = {
  name: "",
  description: ""
};

const emptyArticleDraft: ArticleDraft = {
  name: "",
  categoryId: "",
  sku: "",
  description: "",
  unit: "",
  price: "",
  active: true
};

export function CatalogPage({ catalogService }: CatalogPageProps) {
  const auth = useAuth();
  const canManageCatalog = auth.session?.role === "user";
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [categoryDraft, setCategoryDraft] =
    useState<CategoryDraft>(emptyCategoryDraft);
  const [editingCategoryDraft, setEditingCategoryDraft] =
    useState<CategoryDraft | null>(null);
  const [articleDraft, setArticleDraft] =
    useState<ArticleDraft>(emptyArticleDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const { notify } = useToast();

  const loadCatalog = useCallback(() => {
    setState({ status: "loading" });
    void catalogService
      .list()
      .then((catalog) => {
        setState({ status: "success", catalog });
        setArticleDraft((current) => ({
          ...current,
          categoryId: current.categoryId || catalog.categories[0]?.id || ""
        }));
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudo cargar el catalogo."
        });
      });
  }, [catalogService]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const categories = useMemo(
    () => (state.status === "success" ? state.catalog.categories : []),
    [state]
  );
  const articles = useMemo(
    () => (state.status === "success" ? state.catalog.articles : []),
    [state]
  );
  const articleCountByCategory = useMemo(() => {
    return articles.reduce<Record<string, number>>((counts, article) => {
      counts[article.categoryId] = (counts[article.categoryId] ?? 0) + 1;
      return counts;
    }, {});
  }, [articles]);

  const saveCategory = async (options: { closeAfterSave: boolean }) => {
    const input = parseCategoryDraft(categoryDraft);

    if (!input) {
      notify({
        type: "warning",
        message: "El nombre de la categoria es obligatorio."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await catalogService.createCategory(input);
      notify({ type: "success", message: "Categoria creada correctamente." });

      setCategoryDraft(emptyCategoryDraft);
      if (options.closeAfterSave) {
        setCategoryDialogOpen(false);
      }
      loadCatalog();
    } catch (error) {
      notify({ type: "error", message: getCatalogErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveCategoryEdit = useCallback(() => {
    if (!editingCategoryDraft?.id) {
      return;
    }

    const input = parseCategoryDraft(editingCategoryDraft);

    if (!input) {
      notify({
        type: "warning",
        message: "El nombre de la categoria es obligatorio."
      });
      return;
    }

    setIsSubmitting(true);
    void catalogService
      .updateCategory(editingCategoryDraft.id, input)
      .then(() => {
        notify({
          type: "success",
          message: "Categoria actualizada correctamente."
        });
        setEditingCategoryDraft(null);
        loadCatalog();
      })
      .catch((error: unknown) => {
        notify({ type: "error", message: getCatalogErrorMessage(error) });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [catalogService, editingCategoryDraft, loadCatalog, notify]);

  const saveArticle = async (options: { closeAfterSave: boolean }) => {
    const input = parseArticleDraft(articleDraft);

    if (!input) {
      notify({
        type: "warning",
        message: "El articulo necesita nombre, categoria y un precio valido."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (articleDraft.id) {
        await catalogService.updateArticle(articleDraft.id, input);
        notify({ type: "success", message: "Articulo actualizado correctamente." });
      } else {
        await catalogService.createArticle(input);
        notify({ type: "success", message: "Articulo creado correctamente." });
      }

      setArticleDraft({
        ...emptyArticleDraft,
        categoryId: categories[0]?.id || ""
      });
      if (options.closeAfterSave) {
        setArticleDialogOpen(false);
      }
      loadCatalog();
    } catch (error) {
      notify({ type: "error", message: getCatalogErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeCategory = useCallback(
    (category: CatalogCategory) => {
      void catalogService
        .deleteCategory(category.id)
        .then(() => {
          notify({ type: "success", message: "Categoria eliminada." });
          loadCatalog();
        })
        .catch((error: unknown) => {
          notify({ type: "error", message: getCatalogErrorMessage(error) });
        });
    },
    [catalogService, loadCatalog, notify]
  );

  const removeArticle = useCallback(
    (article: CatalogArticle) => {
      void catalogService
        .deleteArticle(article.id)
        .then(() => {
          notify({ type: "success", message: "Articulo eliminado." });
          loadCatalog();
        })
        .catch((error: unknown) => {
          notify({ type: "error", message: getCatalogErrorMessage(error) });
        });
    },
    [catalogService, loadCatalog, notify]
  );

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Catalogo"
        title="Articulos y categorias"
        description="Carga y organiza los articulos que despues vas a poder usar como referencia."
      />

      {state.status === "loading" ? (
        <LoadingState title="Cargando catalogo" />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="No se pudo cargar"
          message={state.error}
          actionLabel="Reintentar"
          onAction={loadCatalog}
        />
      ) : null}

      {state.status === "success" ? (
        <>
          {canManageCatalog ? (
            <CategoryCreateDialog
              articleCountByCategory={articleCountByCategory}
              categories={categories}
              draft={categoryDraft}
              disabled={isSubmitting}
              editingDraft={editingCategoryDraft}
              isSubmitting={isSubmitting}
              open={categoryDialogOpen}
              onCancelEdit={() => {
                setEditingCategoryDraft(null);
              }}
              onChangeEdit={setEditingCategoryDraft}
              onOpenChange={(open) => {
                setCategoryDialogOpen(open);
                if (!open) {
                  setCategoryDraft(emptyCategoryDraft);
                  setEditingCategoryDraft(null);
                }
              }}
              onChange={setCategoryDraft}
              onDelete={removeCategory}
              onEdit={(category) => {
                setEditingCategoryDraft({
                  id: category.id,
                  name: category.name,
                  description: category.description ?? ""
                });
              }}
              onSaveEdit={saveCategoryEdit}
              onSubmit={(event) => {
                event.preventDefault();
                void saveCategory({ closeAfterSave: true });
              }}
              onSubmitMore={() => {
                void saveCategory({ closeAfterSave: false });
              }}
            />
          ) : null}

          {canManageCatalog ? (
            <>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    setArticleDraft({
                      ...emptyArticleDraft,
                      categoryId: categories[0]?.id || ""
                    });
                    setArticleDialogOpen(true);
                  }}
                >
                  <PackagePlus aria-hidden="true" className="mr-2 h-4 w-4" />
                  Nuevo articulo
                </Button>
              </div>

              <Dialog
                open={articleDialogOpen}
                onOpenChange={(open) => {
                  setArticleDialogOpen(open);
                  if (!open) {
                    setArticleDraft({
                      ...emptyArticleDraft,
                      categoryId: categories[0]?.id || ""
                    });
                  }
                }}
              >
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>
                      {articleDraft.id ? "Editar articulo" : "Nuevo articulo"}
                    </DialogTitle>
                    <DialogDescription>
                      Carga y actualiza los articulos del catalogo.
                    </DialogDescription>
                  </DialogHeader>

                  <ArticleForm
                    categories={categories}
                    draft={articleDraft}
                    disabled={isSubmitting || categories.length === 0}
                    onCancel={() => {
                      setArticleDraft({
                        ...emptyArticleDraft,
                        categoryId: categories[0]?.id || ""
                      });
                      setArticleDialogOpen(false);
                    }}
                    onChange={setArticleDraft}
                    onSubmit={(options) => {
                      void saveArticle(options);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </>
          ) : null}

          <ArticlesList
            articles={articles}
            canManageCatalog={canManageCatalog}
            onDelete={removeArticle}
            onEdit={(article) => {
              setArticleDraft({
                id: article.id,
                name: article.name,
                categoryId: article.categoryId,
                sku: article.sku ?? "",
                description: article.description ?? "",
                unit: article.unit ?? "",
                price:
                  typeof article.price === "number" ? String(article.price) : "",
                active: article.active
              });
              setArticleDialogOpen(true);
            }}
          />
        </>
      ) : null}
    </section>
  );
}

function CategoryCreateDialog({
  articleCountByCategory,
  categories,
  draft,
  disabled,
  editingDraft,
  isSubmitting,
  open,
  onCancelEdit,
  onChange,
  onChangeEdit,
  onDelete,
  onEdit,
  onOpenChange,
  onSaveEdit,
  onSubmitMore,
  onSubmit
}: {
  articleCountByCategory: Record<string, number>;
  categories: CatalogCategory[];
  draft: CategoryDraft;
  disabled: boolean;
  editingDraft: CategoryDraft | null;
  isSubmitting: boolean;
  open: boolean;
  onCancelEdit(this: void): void;
  onChange(this: void, draft: CategoryDraft): void;
  onChangeEdit(this: void, draft: CategoryDraft): void;
  onDelete(this: void, category: CatalogCategory): void;
  onEdit(this: void, category: CatalogCategory): void;
  onOpenChange(this: void, open: boolean): void;
  onSaveEdit(this: void): void;
  onSubmitMore(this: void): void;
  onSubmit(this: void, event: FormEvent<HTMLFormElement>): void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">Categorias</h2>
        <p className="text-sm text-muted-foreground">
          Administra las categorias base del catalogo.
        </p>
      </div>
      <Button type="button" onClick={() => onOpenChange(true)}>
        <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
        Categorias
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl gap-5 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Categorias</DialogTitle>
            <DialogDescription>
              Crea, revisa y edita las categorias del catalogo.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end sm:p-4"
            onSubmit={onSubmit}
          >
            <label className="grid gap-2 text-sm font-medium">
              Nombre
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.name}
                onChange={(event) => {
                  onChange({ ...draft, name: event.target.value });
                }}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Descripcion
              <input
                className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.description}
                onChange={(event) => {
                  onChange({ ...draft, description: event.target.value });
                }}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled}
                type="button"
                variant="secondary"
                onClick={onSubmitMore}
              >
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                Agregar mas
              </Button>
              <Button disabled={disabled} type="submit">
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                Crear
              </Button>
            </div>
          </form>

          <CategoriesList
            articleCountByCategory={articleCountByCategory}
            canManageCatalog
            categories={categories}
            editingDraft={editingDraft}
            isSubmitting={isSubmitting}
            onCancelEdit={onCancelEdit}
            onChangeEdit={onChangeEdit}
            onDelete={onDelete}
            onEdit={onEdit}
            onSaveEdit={onSaveEdit}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArticleForm({
  categories,
  draft,
  disabled,
  onCancel,
  onChange,
  onSubmit
}: {
  categories: CatalogCategory[];
  draft: ArticleDraft;
  disabled: boolean;
  onCancel(this: void): void;
  onChange(this: void, draft: ArticleDraft): void;
  onSubmit(this: void, options: { closeAfterSave: boolean }): void;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ closeAfterSave: true });
      }}
    >
      {categories.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          Primero crea una categoria para poder cargar articulos.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Nombre
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.name}
            onChange={(event) => {
              onChange({ ...draft, name: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Categoria
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.categoryId}
            onChange={(event) => {
              onChange({ ...draft, categoryId: event.target.value });
            }}
          >
            <option value="">Seleccionar</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          SKU
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.sku}
            onChange={(event) => {
              onChange({ ...draft, sku: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Unidad
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="unidad, kg, litro"
            value={draft.unit}
            onChange={(event) => {
              onChange({ ...draft, unit: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Precio
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            min="0"
            step="0.01"
            type="number"
            value={draft.price}
            onChange={(event) => {
              onChange({ ...draft, price: event.target.value });
            }}
          />
        </label>
        <label className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium">
          <input
            checked={draft.active}
            className="h-4 w-4 accent-primary"
            type="checkbox"
            onChange={(event) => {
              onChange({ ...draft, active: event.target.checked });
            }}
          />
          Activo
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Descripcion
        <textarea
          className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={draft.description}
          onChange={(event) => {
            onChange({ ...draft, description: event.target.value });
          }}
        />
      </label>

      <FormActions
        disabled={disabled}
        isEditing={Boolean(draft.id)}
        submitLabel={draft.id ? "Guardar" : "Crear"}
        onSubmitMore={() => onSubmit({ closeAfterSave: false })}
        onCancel={onCancel}
      />
    </form>
  );
}

function FormActions({
  disabled,
  isEditing,
  onSubmitMore,
  submitLabel,
  onCancel
}: {
  disabled: boolean;
  isEditing: boolean;
  onSubmitMore(this: void): void;
  submitLabel: string;
  onCancel(this: void): void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {!isEditing ? (
        <Button
          disabled={disabled}
          type="button"
          variant="secondary"
          onClick={onSubmitMore}
        >
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          Agregar mas
        </Button>
      ) : null}
      <Button disabled={disabled} type="submit">
        {isEditing ? (
          <Save aria-hidden="true" className="mr-2 h-4 w-4" />
        ) : (
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
        )}
        {submitLabel}
      </Button>
      {isEditing ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          <X aria-hidden="true" className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      ) : null}
    </div>
  );
}

function CategoriesList({
  articleCountByCategory,
  canManageCatalog,
  categories,
  editingDraft,
  isSubmitting,
  onCancelEdit,
  onChangeEdit,
  onDelete,
  onEdit,
  onSaveEdit
}: {
  articleCountByCategory: Record<string, number>;
  canManageCatalog: boolean;
  categories: CatalogCategory[];
  editingDraft: CategoryDraft | null;
  isSubmitting: boolean;
  onCancelEdit(this: void): void;
  onChangeEdit(this: void, draft: CategoryDraft): void;
  onDelete(this: void, category: CatalogCategory): void;
  onEdit(this: void, category: CatalogCategory): void;
  onSaveEdit(this: void): void;
}) {
  if (categories.length === 0) {
    return (
      <EmptyState
        title="Sin categorias"
        message="Todavia no hay categorias cargadas en el catalogo."
      />
    );
  }

  return (
    <section className="grid gap-3">
      {!canManageCatalog ? (
        <h2 className="text-lg font-semibold">Categorias</h2>
      ) : null}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Descripcion</th>
              <th className="px-4 py-3 font-medium">Articulos</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const isEditing = editingDraft?.id === category.id;

              return (
                <tr key={category.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    {isEditing ? (
                      <input
                        className="h-10 w-full min-w-40 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={editingDraft.name}
                        onChange={(event) => {
                          onChangeEdit({
                            ...editingDraft,
                            name: event.target.value
                          });
                        }}
                      />
                    ) : (
                      category.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {isEditing ? (
                      <input
                        className="h-10 w-full min-w-52 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={editingDraft.description}
                        onChange={(event) => {
                          onChangeEdit({
                            ...editingDraft,
                            description: event.target.value
                          });
                        }}
                      />
                    ) : (
                      category.description || "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {articleCountByCategory[category.id] ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          aria-label={`Guardar categoria ${category.name}`}
                          disabled={isSubmitting}
                          size="icon"
                          type="button"
                          onClick={onSaveEdit}
                        >
                          <Save aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={`Cancelar edicion de ${category.name}`}
                          size="icon"
                          type="button"
                          variant="outline"
                          onClick={onCancelEdit}
                        >
                          <X aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <CatalogActions
                        canManageCatalog={canManageCatalog}
                        deleteLabel={`Eliminar categoria ${category.name}`}
                        editLabel={`Editar categoria ${category.name}`}
                        onDelete={() => {
                          onDelete(category);
                        }}
                        onEdit={() => {
                          onEdit(category);
                        }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {categories.map((category) => {
          const isEditing = editingDraft?.id === category.id;

          return (
            <article
              key={category.id}
              className="rounded-lg border border-border bg-card p-3 shadow-sm"
            >
              {isEditing ? (
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-medium">
                    Nombre
                    <input
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editingDraft.name}
                      onChange={(event) => {
                        onChangeEdit({
                          ...editingDraft,
                          name: event.target.value
                        });
                      }}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Descripcion
                    <input
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editingDraft.description}
                      onChange={(event) => {
                        onChangeEdit({
                          ...editingDraft,
                          description: event.target.value
                        });
                      }}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={isSubmitting}
                      size="sm"
                      type="button"
                      onClick={onSaveEdit}
                    >
                      <Save aria-hidden="true" className="mr-2 h-4 w-4" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={onCancelEdit}
                    >
                      <X aria-hidden="true" className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {category.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {category.description || "-"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {articleCountByCategory[category.id] ?? 0}
                    </span>
                  </div>
                  <div className="mt-3">
                    <CatalogActions
                      canManageCatalog={canManageCatalog}
                      deleteLabel={`Eliminar categoria ${category.name}`}
                      editLabel={`Editar categoria ${category.name}`}
                      onDelete={() => {
                        onDelete(category);
                      }}
                      onEdit={() => {
                        onEdit(category);
                      }}
                    />
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ArticlesList({
  articles,
  canManageCatalog,
  onDelete,
  onEdit
}: {
  articles: CatalogArticle[];
  canManageCatalog: boolean;
  onDelete(this: void, article: CatalogArticle): void;
  onEdit(this: void, article: CatalogArticle): void;
}) {
  if (articles.length === 0) {
    return (
      <EmptyState
        title="Sin articulos"
        message="Todavia no hay articulos cargados en el catalogo."
      />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Articulos</h2>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Articulo</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{article.name}</p>
                  {article.description ? (
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                      {article.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">{article.categoryName}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {article.sku || "-"}
                </td>
                <td className="px-4 py-3">{article.unit || "-"}</td>
                <td className="px-4 py-3">{formatPrice(article.price)}</td>
                <td className="px-4 py-3">
                  <StatusBadge active={article.active} />
                </td>
                <td className="px-4 py-3">
                  <CatalogActions
                    canManageCatalog={canManageCatalog}
                    deleteLabel={`Eliminar articulo ${article.name}`}
                    editLabel={`Editar articulo ${article.name}`}
                    onDelete={() => {
                      onDelete(article);
                    }}
                    onEdit={() => {
                      onEdit(article);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {articles.map((article) => (
          <article
            key={article.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{article.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {article.categoryName}
                </p>
              </div>
              <StatusBadge active={article.active} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">SKU</dt>
                <dd className="font-medium">{article.sku || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Unidad</dt>
                <dd className="font-medium">{article.unit || "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Precio</dt>
                <dd className="text-lg font-semibold">
                  {formatPrice(article.price)}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <CatalogActions
                canManageCatalog={canManageCatalog}
                deleteLabel={`Eliminar articulo ${article.name}`}
                editLabel={`Editar articulo ${article.name}`}
                onDelete={() => {
                  onDelete(article);
                }}
                onEdit={() => {
                  onEdit(article);
                }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CatalogActions({
  canManageCatalog,
  deleteLabel,
  editLabel,
  onDelete,
  onEdit
}: {
  canManageCatalog: boolean;
  deleteLabel: string;
  editLabel: string;
  onDelete(this: void): void;
  onEdit(this: void): void;
}) {
  if (!canManageCatalog) {
    return <span className="text-sm text-muted-foreground">Solo lectura</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        aria-label={editLabel}
        size="icon"
        type="button"
        variant="outline"
        onClick={onEdit}
      >
        <Edit aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        aria-label={deleteLabel}
        size="icon"
        type="button"
        variant="outline"
        onClick={onDelete}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "inline-flex rounded-md bg-success px-2 py-1 text-xs font-medium text-success-foreground"
          : "inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
      }
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function parseCategoryDraft(draft: CategoryDraft): CategoryInput | null {
  const name = draft.name.trim();

  if (!name) {
    return null;
  }

  return {
    name,
    ...(draft.description.trim()
      ? { description: draft.description.trim() }
      : {})
  };
}

function parseArticleDraft(draft: ArticleDraft): ArticleInput | null {
  const name = draft.name.trim();
  const categoryId = draft.categoryId.trim();
  const price = draft.price.trim() ? Number(draft.price) : undefined;

  if (!name || !categoryId || (price !== undefined && price < 0)) {
    return null;
  }

  return {
    name,
    categoryId,
    ...(draft.sku.trim() ? { sku: draft.sku.trim() } : {}),
    ...(draft.description.trim()
      ? { description: draft.description.trim() }
      : {}),
    ...(draft.unit.trim() ? { unit: draft.unit.trim() } : {}),
    ...(price !== undefined ? { price } : {}),
    active: draft.active
  };
}

function formatPrice(price: number | undefined) {
  if (typeof price !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(price);
}

function getCatalogErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Category has articles.") {
    return "No se puede eliminar una categoria con articulos asociados.";
  }

  return "No se pudo guardar el cambio en el catalogo.";
}
