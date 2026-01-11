/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { EMLLibError, ErrorType } from '../../types/errors'
import { INews, INewsCategory } from '../../types/news'

/**
 * Manage the News of the Launcher.
 *
 * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
 */
export default class News {
  private readonly url: string

  /**
   * @param url The URL of your EML AdminTool website.
   */
  constructor(url: string) {
    this.url = `${url}/api`
  }

  /**
   * Get all the news from the EML AdminTool.
   * @returns The list of News.
   */
  async getNews() {
    try {
      const req = await fetch(`${this.url}/news`)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching News from the EML AdminTool: HTTP ${req.status} ${errorText}`)
      }
      const data: { news: INews[] } = await req.json()

      return data.news
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching News from the EML AdminTool: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Get all the News categories from the EML AdminTool.
   * @returns The list of News categories.
   */
  async getCategories() {
    try {
      const req = await fetch(`${this.url}/news/categories`)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching News Categories from the EML AdminTool: HTTP ${req.status} ${errorText}`)
      }
      const data: { categories: INewsCategory[] } = await req.json()

      return data.categories
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(
        ErrorType.FETCH_ERROR,
        `Error while fetching News Categories from the EML AdminTool: ${err instanceof Error ? err.message : err}`
      )
    }
  }

  /**
   * Get the News of a specific category.
   * @param id The ID of the category (got from `News.getCategories()`).
   * @returns The News if the category.
   * @deprecated Returns an empty array — Currently not used in the EML AdminTool, but may be used in the future. Please use `News.getNews().filter(...)` instead.
   */
  async getNewsByCategory(categoryId: number) {
    return [] as INews[] // Currently not used in the EML AdminTool, but may be used in the future.
    // let res = await fetch(`${this.url}/news/categories/${categoryId}`)
    //   .then((res) => res.json())
    //   .catch((err) => {
    //     throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching News Categories from the EML AdminTool: ${err}`)
    //   })

    // if (res.status === 404) res.data = []

    // return res.data as INews[]
  }
}
