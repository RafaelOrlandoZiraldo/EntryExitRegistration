export interface CatalogCategory {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface CatalogArticle {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  sku?: string;
  description?: string;
  unit?: string;
  price?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface CatalogSnapshot {
  categories: CatalogCategory[];
  articles: CatalogArticle[];
}

export interface CategoryInput {
  name: string;
  description?: string;
}

export interface ArticleInput {
  name: string;
  categoryId: string;
  sku?: string;
  description?: string;
  unit?: string;
  price?: number;
  active?: boolean;
}

class HttpCatalogService {
  async list(): Promise<CatalogSnapshot> {
    const response = await fetch("/api/catalog", {
      credentials: "include"
    });

    const body = await readSuccessfulJson(response);

    return {
      categories: Array.isArray(body.categories)
        ? (body.categories as CatalogCategory[])
        : [],
      articles: Array.isArray(body.articles)
        ? (body.articles as CatalogArticle[])
        : []
    };
  }

  async createCategory(input: CategoryInput): Promise<CatalogCategory> {
    const response = await fetch("/api/catalog/categories", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.category as CatalogCategory;
  }

  async updateCategory(
    id: string,
    input: CategoryInput
  ): Promise<CatalogCategory> {
    const response = await fetch(`/api/catalog/categories/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.category as CatalogCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`/api/catalog/categories/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    await readSuccessfulJson(response);
  }

  async createArticle(input: ArticleInput): Promise<CatalogArticle> {
    const response = await fetch("/api/catalog/articles", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.article as CatalogArticle;
  }

  async updateArticle(id: string, input: ArticleInput): Promise<CatalogArticle> {
    const response = await fetch(`/api/catalog/articles/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.article as CatalogArticle;
  }

  async deleteArticle(id: string): Promise<void> {
    const response = await fetch(`/api/catalog/articles/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    await readSuccessfulJson(response);
  }
}

async function readSuccessfulJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Error.");
  }

  return body;
}

export const catalogServices = {
  catalog: new HttpCatalogService()
};
