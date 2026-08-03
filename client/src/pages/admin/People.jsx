import { useState } from 'react'
import { users } from '../../api'
import { useApi, useAction } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { Avatar, Empty, Field, Results } from '../../components/ui'
import { date } from '../../utils/format'

/** The user directory, and the only place a role can be changed. */
export default function People() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const { run, pending } = useAction()
  const { data, loading, error, reload } = useApi(
    () => users.list({ q: q || undefined, role: role || undefined, per_page: 50 }),
    [q, role]
  )

  const changeRole = (person, nextRole) =>
    run(() => users.update(person.user_id, { role: nextRole }), () => {
      toast.success(`${person.full_name} is now ${nextRole}`)
      reload()
    })

  return (
    <>
      <div className="filters">
        <Field
          label="Search"
          placeholder="Name, email or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Field label="Role" as="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="resident">Residents</option>
          <option value="provider">Providers</option>
          <option value="security">Security</option>
          <option value="admin">Admins</option>
        </Field>
      </div>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={<Empty title="Nobody matches that" />}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Estate</th>
                <th>Role</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((person) => (
                <tr key={person.user_id}>
                  <td>
                    <span className="row">
                      <Avatar user={person} />
                      {person.full_name}
                    </span>
                  </td>
                  <td className="small">
                    {person.email}
                    <br />
                    {person.phone}
                  </td>
                  <td>{person.estate?.estate_name || '—'}</td>
                  <td>
                    <span className="badge badge-info">{person.role}</span>
                  </td>
                  <td>{date(person.created_at)}</td>
                  <td>
                    <select
                      value={person.role}
                      disabled={pending}
                      onChange={(e) => changeRole(person, e.target.value)}
                    >
                      {['resident', 'provider', 'security', 'admin'].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Results>
    </>
  )
}
