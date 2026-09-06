'use client'

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'

const starterPrompts = [
  'Who are the highest-rated professors?',
  'Which professors are known for engaging lectures?',
  'Who has the most challenging classes?',
]

const initialMessages = [
  {
    role: 'assistant',
    content:
      'Ask a question about the demo professor reviews. I’ll search the review data and show the sources used for the answer.',
    sources: [],
  },
]

function SourceCard({ source }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={0.75}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          gap={0.5}
        >
          <Box>
            <Typography fontWeight={700} variant="body2">
              {source.professor}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {source.subject}
            </Typography>
          </Box>
          {source.stars !== null && (
            <Chip
              size="small"
              label={`${source.stars}/5`}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, fontWeight: 700 }}
            />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" lineHeight={1.55}>
          “{source.review}”
        </Typography>
      </Stack>
    </Paper>
  )
}

function ChatMessage({ message }) {
  const isAssistant = message.role === 'assistant'

  return (
    <Box display="flex" justifyContent={isAssistant ? 'flex-start' : 'flex-end'}>
      <Stack
        spacing={1.25}
        sx={{
          width: isAssistant ? 'min(760px, 100%)' : 'auto',
          maxWidth: isAssistant ? '100%' : '80%',
          alignItems: isAssistant ? 'stretch' : 'flex-end',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1.6,
            borderRadius: 3,
            bgcolor: isAssistant ? 'background.paper' : 'primary.main',
            color: isAssistant ? 'text.primary' : 'primary.contrastText',
            border: isAssistant ? '1px solid' : 'none',
            borderColor: 'divider',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.65,
          }}
        >
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography>
        </Paper>

        {isAssistant && message.sources?.length > 0 && (
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.75, fontWeight: 700, letterSpacing: 1 }}
            >
              Retrieved reviews
            </Typography>
            <Stack spacing={1}>
              {message.sources.map((source, index) => (
                <SourceCard
                  key={`${source.professor}-${source.subject}-${index}`}
                  source={source}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  )
}

export default function Home() {
  const [messages, setMessages] = useState(initialMessages)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = async (overrideMessage) => {
    const trimmedMessage = (overrideMessage ?? message).trim()
    if (!trimmedMessage || isLoading) return

    const nextMessages = [...messages, { role: 'user', content: trimmedMessage }]

    setMessage('')
    setMessages(nextMessages)
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: nextMessages }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to get a response.')
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
        },
      ])
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: error.message || 'Something went wrong. Please try again.',
          sources: [],
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    if (isLoading) return
    setMessages(initialMessages)
    setMessage('')
  }

  return (
    <Box minHeight="100vh" bgcolor="background.default">
      <Box
        component="header"
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            minHeight={72}
            gap={2}
          >
            <Box>
              <Typography variant="h6" fontWeight={800} letterSpacing={-0.4}>
                ProfessorAI
              </Typography>
              <Typography variant="caption" color="text.secondary">
                RAG-powered professor review search
              </Typography>
            </Box>
            <Button variant="text" onClick={clearChat} disabled={isLoading}>
              Clear chat
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={3.5}>
          <Box maxWidth={760}>
            <Typography
              variant="h3"
              fontWeight={800}
              letterSpacing={-1.5}
              sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
            >
              Explore professor reviews with AI
            </Typography>
            <Typography color="text.secondary" mt={1.25} lineHeight={1.7}>
              Ask natural-language questions and get answers grounded in semantically
              retrieved review data from Pinecone.
            </Typography>
          </Box>

          <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
            {starterPrompts.map((prompt) => (
              <Chip
                key={prompt}
                label={prompt}
                onClick={() => sendMessage(prompt)}
                clickable
                disabled={isLoading}
                sx={{
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              />
            ))}
          </Stack>

          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 4,
              overflow: 'hidden',
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{
                minHeight: { xs: 420, md: 520 },
                maxHeight: { xs: '58vh', md: '62vh' },
                overflowY: 'auto',
                p: { xs: 2, md: 3 },
                bgcolor: '#f8fafc',
              }}
            >
              <Stack spacing={2.5}>
                {messages.map((chatMessage, index) => (
                  <ChatMessage key={`${chatMessage.role}-${index}`} message={chatMessage} />
                ))}

                {isLoading && (
                  <Box display="flex" justifyContent="flex-start">
                    <Paper
                      elevation={0}
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <CircularProgress size={18} thickness={5} />
                        <Typography variant="body2" color="text.secondary">
                          Searching reviews and generating an answer...
                        </Typography>
                      </Stack>
                    </Paper>
                  </Box>
                )}
                <div ref={bottomRef} />
              </Stack>
            </Box>

            <Divider />

            <Box p={{ xs: 1.5, md: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <TextField
                  placeholder="Ask about ratings, teaching style, workload, or subjects..."
                  fullWidth
                  multiline
                  minRows={1}
                  maxRows={4}
                  value={message}
                  disabled={isLoading}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      sendMessage()
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      bgcolor: '#fff',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => sendMessage()}
                  disabled={isLoading || !message.trim()}
                  sx={{
                    minWidth: { xs: '100%', sm: 120 },
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 700,
                  }}
                >
                  Send
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Demo data is synthetic and intended to demonstrate the RAG architecture.
              </Typography>
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  )
}
