import { useState } from 'react'
import { notifications } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { Empty, PageHeader, Pagination, Results } from '../components/ui'
import { NotificationItem } from '../components/cards'

/**
 * The bell, in full.
 *
 * Notifications are raised as a side effect of the thing that happened —
 * a booking accepted, a payment cleared, a ride cancelled — and committed
 * in the same transaction, so you never get told about something that did
 * not actually save.
 */
export default function Notifications() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { run, pending } = useAction()

  const { data, loading, error, reload } = useApi(
    () => notifications.list({ page, is_read: unreadOnly ? 'false' : undefined }),
    [page, unreadOnly]
  )

  const markRead = (note) =>
    run(() => notifications.markRead(note.notification_id), reload)

  const remove = (note) =>
    run(() => notifications.remove(note.notification_id), () => {
      toast.success('Deleted')
      reload()
    })

  const markAll = () =>
    run(() => notifications.markAllRead(), (result) => {
      toast.success(`${result.updated} marked as read`)
      reload()
    })

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Everything the platform has told you, newest first."
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setPage(1)
            setUnreadOnly((v) => !v)
          }}
        >
          {unreadOnly ? 'Show all' : 'Unread only'}
        </button>
        <button type="button" className="btn" disabled={pending} onClick={markAll}>
          Mark all read
        </button>
      </PageHeader>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={
          <Empty title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}>
            Book a service or claim a ride, and updates will appear here.
          </Empty>
        }
      >
        <div className="list">
          {data?.items?.map((note) => (
            <NotificationItem
              key={note.notification_id}
              note={note}
              onRead={markRead}
              onDelete={remove}
            />
          ))}
        </div>
      </Results>

      <Pagination page={data?.page} pages={data?.pages} onChange={setPage} />
    </>
  )
}
