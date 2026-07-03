import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import Sidebar from './Sidebar'
import type { SidebarProps } from '../types'

function makeProps(overrides: Partial<SidebarProps> = {}): SidebarProps {
  return {
    logoStyle: {},
    navTrackStyle: {},
    navProjectsStyle: {},
    navServicesStyle: {},
    navCustomersStyle: {},
    navExportStyle: {},
    navEarningsStyle: {},
    onNavTrack: vi.fn(),
    onNavProjects: vi.fn(),
    onNavServices: vi.fn(),
    onNavCustomers: vi.fn(),
    onNavExport: vi.fn(),
    onNavEarnings: vi.fn(),
    monthHours: '0h',
    monthDaysStr: '0',
    monthEarnStr: '€0',
    periodLabel: 'This week',
    syncColor: '#9ca3af',
    syncLabel: 'Saved in browser',
    syncStatus: 'idle',
    onOpenSettings: vi.fn(),
    accent: '#2563eb',
    isAuthenticated: true,
    onSignIn: vi.fn(),
    ...overrides,
  }
}

describe('Sidebar', () => {
  test('adds the open-state class when isOpen is true', () => {
    const { container, rerender } = render(<Sidebar {...makeProps({ isOpen: true })} />)

    expect(container.querySelector('.sidebar')).toHaveClass('sidebar--open')

    rerender(<Sidebar {...makeProps({ isOpen: false })} />)

    expect(container.querySelector('.sidebar')).not.toHaveClass('sidebar--open')
  })

  test('clicking a navigation item calls its handler and onClose', async () => {
    const user = userEvent.setup()
    const onNavTrack = vi.fn()
    const onClose = vi.fn()

    render(<Sidebar {...makeProps({ onNavTrack, onClose })} />)
    await user.click(screen.getByRole('button', { name: 'Track' }))

    expect(onNavTrack).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking Earnings calls onNavEarnings and onClose', async () => {
    const user = userEvent.setup()
    const onNavEarnings = vi.fn()
    const onClose = vi.fn()

    render(<Sidebar {...makeProps({ onNavEarnings, onClose })} />)
    await user.click(screen.getByRole('button', { name: 'Earnings' }))

    expect(onNavEarnings).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking Services calls onNavServices and onClose', async () => {
    const user = userEvent.setup()
    const onNavServices = vi.fn()
    const onClose = vi.fn()

    render(<Sidebar {...makeProps({ onNavServices, onClose })} />)
    await user.click(screen.getByRole('button', { name: 'Services' }))

    expect(onNavServices).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
