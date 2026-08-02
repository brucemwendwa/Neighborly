import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { categories, services } from '../api'
import { useApi } from '../hooks/useApi'
import { Field, PageHeader, Pagination, Results, Empty } from '../components/ui'
import { ServiceCard } from '../components/cards'

/**
 * The catalogue — GET /api/services with the filters the API supports.
 *
 * Filter state lives in the URL rather than in useState, so a filtered view
 * can be shared, bookmarked and survives a refresh. Changing a filter
 * changes the query string, which changes the `deps` of useApi, which
 * refetches. One source of truth.
 */
export default function Services() {
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState(params.get('q') || '')

  const q = params.get('q') || ''
  const categoryId = params.get('category_id') || ''
  const maxPrice = params.get('max_price') || ''
  const page = Number(params.get('page') || 1)

  const { data: catData } = useApi(() => categories.list(), [])
  const { data, loading, error, reload } = useApi(
    () =>
      services.list({
        q: q || undefined,
        category_id: categoryId || undefined,
        max_price: maxPrice || undefined,
        page,
      }),
    [q, categoryId, maxPrice, page]
  )

  /** Merge one filter into the query string, resetting to page 1. */
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <>
      <PageHeader
        title="Services"
        description="Vetted providers working inside your estate. Prices shown are the
          starting point — the exact figure is agreed on the booking."
      />

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault()
          setFilter('q', draft)
        }}
      >
        <Field
          label="Search"
          placeholder="Plumbing, cleaning…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Field
          label="Category"
          as="select"
          value={categoryId}
          onChange={(e) => setFilter('category_id', e.target.value)}
        >
          <option value="">All categories</option>
          {catData?.items?.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.name}
            </option>
          ))}
        </Field>
        <Field
          label="Max price (KES)"
          type="number"
          min="0"
          value={maxPrice}
          onChange={(e) => setFilter('max_price', e.target.value)}
        />
        <button type="submit" className="btn">
          Search
        </button>
        {(q || categoryId || maxPrice) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDraft('')
              setParams({})
            }}
          >
            Clear
          </button>
        )}
      </form>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={
          <Empty title="No services match that">
            Try a wider price range, or clear the filters.
          </Empty>
        }
      >
        <div className="grid-wide">
          {data?.items?.map((service) => (
            <ServiceCard key={service.service_id} service={service} />
          ))}
        </div>
      </Results>

      <Pagination
        page={data?.page}
        pages={data?.pages}
        onChange={(next) => setFilter('page', String(next))}
      />
    </>
  )
}
