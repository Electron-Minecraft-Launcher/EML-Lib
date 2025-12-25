export interface INews {
  id?: string
  title: string
  content: string
  author: { id: string; username: string }
  createdAt: Date
  updatedAt?: Date | null
  categories?: INewsCategory[]
  tags?: INewsTag[]
}

export interface INewsCategory {
  id?: string
  title: string
  date: string
}

export interface NewsCategoryRes extends INewsCategory {
  news: INews[]
}

export interface INewsTag {
  id?: string
  title: string
  color: string
}
