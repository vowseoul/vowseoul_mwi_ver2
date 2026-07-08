import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabase'

export const BUCKET_NAME = 'vow-seoul-storage'

/**
 * Uploads a file to Supabase Storage
 * @param file The file to upload
 * @param path The path/folder inside the bucket (e.g. 'invitations/main')
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    const fileExtension = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExtension}`
    const filePath = `${path}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    return data.publicUrl
  } catch (error) {
    console.error('Error uploading file:', error)
    throw new Error('파일 업로드에 실패했습니다.')
  }
}

/**
 * Deletes a file from Supabase Storage using its public URL
 * @param publicUrl The public URL of the file to delete
 */
export async function deleteFile(publicUrl: string): Promise<void> {
  try {
    // Extract the file path from the public URL
    const urlParts = publicUrl.split(`${BUCKET_NAME}/`)
    if (urlParts.length !== 2) return

    const filePath = urlParts[1]

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error deleting file:', error)
    throw new Error('파일 삭제에 실패했습니다.')
  }
}
