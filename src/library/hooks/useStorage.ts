
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export function useStorage() {
    const [storageDir, setStorageDir] = useState<string | null>(null)
    const [storageLoading, setStorageLoading] = useState(true)
    const [storageError, setStorageError] = useState('')

    useEffect(() => {
        invoke<string | null>('get_storage_dir')
            .then(setStorageDir)
            .catch((error) => setStorageError(String(error)))
            .finally(() => setStorageLoading(false))
    }, [])

    async function handleChooseStorage() {
        setStorageError('')

        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Choose library storage location',
            })

            if (typeof selected !== 'string') return

            const saved = await invoke<string>('set_storage_dir', {
                storageDir: selected,
            })

            setStorageDir(saved)
        } catch (error) {
            setStorageError(String(error))
        }
    }

    return {
        storageDir,
        storageLoading,
        storageError,
        setStorageError,
        handleChooseStorage,
    }
}
