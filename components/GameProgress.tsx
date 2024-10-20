"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Moon, Sun } from "lucide-react"
import { turnOrder, roles } from "@/lib/gameData"
import { Player, GameData, ActionLog, Action } from "@/lib/types"
import RoleMap from "./RoleMap"

interface GameProgressProps {
  players: Player[]
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>
  actionLog: ActionLog
  setActionLog: React.Dispatch<React.SetStateAction<ActionLog>>
  gameData: GameData
  setGameData: React.Dispatch<React.SetStateAction<GameData>>
  gameState: "playing" | "ended"
  setGameState: React.Dispatch<React.SetStateAction<"setup" | "playing" | "ended">>
}

export default function GameProgress({
  players,
  setPlayers,
  actionLog,
  setActionLog,
  gameData,
  setGameData,
  gameState,
  setGameState
}: GameProgressProps) {
  const [isNight, setIsNight] = useState(true)
  const [currentTurn, setCurrentTurn] = useState(0)
  const [selectedPlayer, setSelectedPlayer] = useState("")
  const [nightActions, setNightActions] = useState<Action[]>([])
  const [dayVotes, setDayVotes] = useState<Record<string, number>>({})
  const [currentVotingPlayer, setCurrentVotingPlayer] = useState(0)

  const handleNameChange = (id: number, newName: string) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p))
  }

  const handleAction = (action: string) => {
    if (!selectedPlayer && action !== "pass") return

    if (isNight) {
      const newAction: Action = { role: turnOrder[currentTurn], action, target: selectedPlayer }
      setNightActions(prev => [...prev, newAction])
      setActionLog(prev => [`${turnOrder[currentTurn]} ${action} ${selectedPlayer || ''}`, ...prev])
      advanceTurn()
    } else {
      // Day voting
      setDayVotes(prev => ({
        ...prev,
        [selectedPlayer]: (prev[selectedPlayer] || 0) + 1
      }))
      setActionLog(prev => [`${players[currentVotingPlayer].name} voted for ${selectedPlayer}`, ...prev])
      advanceVotingTurn()
    }

    setSelectedPlayer("")
  }

  const advanceTurn = () => {
    setCurrentTurn(prev => (prev + 1) % turnOrder.length)
    if (currentTurn === turnOrder.length - 1) {
      processNightActions()
    }
  }

  const advanceVotingTurn = () => {
    setCurrentVotingPlayer(prev => {
      const next = (prev + 1) % players.length
      if (next === 0) {
        processDayVotes()
        return 0
      }
      return next
    })
  }

  const processNightActions = () => {
    let protectedPlayer = null
    let killedPlayer = null
    let revealedRole = null

    for (const action of nightActions) {
      switch (action.role) {
        case "Paladin":
          if (action.target !== gameData.paladinLastProtected) {
            protectedPlayer = action.target
            setGameData(prev => ({ ...prev, paladinLastProtected: action.target }))
          }
          break
        case "Sorcerer":
          if (action.action === "revive") {
            setPlayers(prev => prev.map(p => p.name === action.target ? { ...p, status: "alive" } : p))
            setGameData(prev => ({ ...prev, sorcererPotions: { ...prev.sorcererPotions, revive: 0 } }))
          } else if (action.action === "kill") {
            killedPlayer = action.target
            setGameData(prev => ({ ...prev, sorcererPotions: { ...prev.sorcererPotions, kill: 0 } }))
          }
          break
        case "Fortune Teller":
          const revealedPlayer = players.find(p => p.name === action.target)
          if (revealedPlayer) {
            revealedRole = revealedPlayer.role
          }
          break
        case "Wolf":
          if (!players.find(p => p.name === action.target && p.role === "Wolf")) {
            killedPlayer = action.target
          }
          break
      }
    }

    if (killedPlayer) {
      if (killedPlayer === protectedPlayer) {
        setActionLog(prev => [`${killedPlayer} was protected by the Paladin`, ...prev])
      } else if (gameData.sorcererPotions.revive > 0) {
        setActionLog(prev => [`${killedPlayer} was revived by the Sorcerer`, ...prev])
        setGameData(prev => ({ ...prev, sorcererPotions: { ...prev.sorcererPotions, revive: 0 } }))
      } else {
        setPlayers(prev => prev.map(p => p.name === killedPlayer ? { ...p, status: "dead" } : p))
        setActionLog(prev => [`${killedPlayer} was killed during the night`, ...prev])
      }
    }

    if (revealedRole) {
      setActionLog(prev => [`Fortune Teller revealed a ${revealedRole}`, ...prev])
    }

    setNightActions([])
    setIsNight(false)
    setActionLog(prev => ["Day breaks", ...prev])
    setCurrentVotingPlayer(0)
  }

  const processDayVotes = () => {
    const voteCounts = Object.entries(dayVotes)
    if (voteCounts.length > 0) {
      const [mostVotedPlayer] = voteCounts.reduce((max, current) => 
        current[1] > max[1] ? current : max
      )
      
      setPlayers(prev => prev.map(p => p.name === mostVotedPlayer ? { ...p, status: "dead" } : p))
      setActionLog(prev => [`${mostVotedPlayer} was voted out by the village`, ...prev])

      const votedOutPlayer = players.find(p => p.name === mostVotedPlayer)
      if (votedOutPlayer && votedOutPlayer.role === "Hunter") {
        setActionLog(prev => ["Hunter can choose a player to kill", ...prev])
        // Implement Hunter's last action here
        const hunterKillAction = (target: string) => {
          setPlayers(prev => prev.map(p => p.name === target ? { ...p, status: "dead" } : p))
          setActionLog(prev => [`Hunter killed ${target}`, ...prev])
          startNight()
        }
        // You need to implement a UI for the Hunter to choose a target
        // For now, let's assume they choose the first alive player that's not themselves
        const hunterTarget = players.find(p => p.status === "alive" && p.name !== mostVotedPlayer)
        if (hunterTarget) {
          hunterKillAction(hunterTarget.name)
        } else {
          startNight()
        }
      } else {
        startNight()
      }
    } else {
      startNight()
    }
  }

  const startNight = () => {
    setDayVotes({})
    setIsNight(true)
    setActionLog(prev => ["Night falls", ...prev])
    setCurrentTurn(0)
    checkGameEnd()
  }

  const checkGameEnd = () => {
    const aliveVillagers = players.filter(p => p.status === "alive" && p.role !== "Wolf").length
    const aliveWolves = players.filter(p => p.status === "alive" && p.role === "Wolf").length

    if (aliveVillagers === 0) {
      setGameState("ended")
      setActionLog(prev => ["Wolves win! All villagers are dead.", ...prev])
    } else if (aliveWolves === 0) {
      setGameState("ended")
      setActionLog(prev => ["Village wins! All wolves are dead.", ...prev])
    }
  }

  useEffect(() => {
    if (gameState === "playing") {
      checkGameEnd()
    }
  }, [players])

  const getSelectablePlayers = () => {
    const alivePlayers = players.filter(p => p.status === "alive")
    if (isNight) {
      if (turnOrder[currentTurn] === "Wolf") {
        return alivePlayers.filter(p => p.role !== "Wolf")
      }
      if (turnOrder[currentTurn] === "Fortune Teller") {
        return alivePlayers.filter(p => p.role !== "Fortune Teller")
      }
    }
    return alivePlayers
  }

  return (
    <Card className="bg-gray-800 text-white">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Game Progress
          {isNight ? (
            <Moon className="h-12 w-12 text-blue-400" />
          ) : (
            <Sun className="h-12 w-12 text-yellow-400" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Players</h3>
            <ScrollArea className="h-48 border rounded-md p-4">
              {players.map((player) => (
                <div key={player.id} className="flex justify-between items-center mb-2">
                  <Input
                    value={player.name}
                    onChange={(e) => handleNameChange(player.id, e.target.value)}
                    className="w-1/2 bg-gray-700 text-white"
                  />
                  <span>{player.role}</span>
                  <Badge variant={player.status === "alive" ? "default" : "destructive"}>
                    {player.status}
                  </Badge>
                </div>
              ))}
            </ScrollArea>
          </div>
          <RoleMap currentRole={turnOrder[currentTurn]} isNight={isNight} />
          <div>
            <h3 className="text-lg font-semibold mb-2">Game State</h3>
            <div className="space-y-4">
              <div>Current Turn: {isNight ? turnOrder[currentTurn] : `${players[currentVotingPlayer].name}'s Vote`}</div>
              <div>
                <h4 className="text-md font-semibold mb-2">Action Log</h4>
                <ScrollArea className="h-32 border rounded-md p-4">
                  {actionLog.map((action, index) => (
                    <div key={index} className="mb-1">
                      {action}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
        {gameState === "playing" && (
          <div className="mt-4 space-y-2">
            <div>
              <Label htmlFor="player">Select Player:</Label>
              <Select onValueChange={setSelectedPlayer} value={selectedPlayer}>
                <SelectTrigger className="w-full bg-gray-700 text-white">
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {getSelectablePlayers().map(player => (
                    <SelectItem key={player.id} value={player.name}>{player.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              {isNight ? (
                <>
                  {turnOrder[currentTurn] === "Paladin" && (
                    <Button onClick={() => handleAction("protect")} disabled={!selectedPlayer} className="bg-blue-500 hover:bg-blue-600 text-white">Protect</Button>
                  )}
                  {turnOrder[currentTurn] === "Sorcerer" && (
                    <>
                      <Button onClick={() => handleAction("revive")} disabled={!selectedPlayer || gameData.sorcererPotions.revive === 0} className="bg-green-500 hover:bg-green-600 text-white">Revive</Button>
                      <Button onClick={() => handleAction("kill")} disabled={!selectedPlayer || gameData.sorcererPotions.kill === 0} className="bg-red-500 hover:bg-red-600 text-white">Kill</Button>
                      <Button onClick={() => handleAction("pass")} className="bg-gray-500 hover:bg-gray-600 text-white">Pass</Button>
                    </>
                  )}
                  {turnOrder[currentTurn] === "Fortune Teller" && (
                    <Button onClick={() => handleAction("reveal")} disabled={!selectedPlayer} className="bg-purple-500 hover:bg-purple-600 text-white">Reveal</Button>
                  )}
                  {turnOrder[currentTurn] === "Wolf" && (
                    <Button onClick={() => handleAction("kill")} disabled={!selectedPlayer} className="bg-red-500 hover:bg-red-600 text-white">Kill</Button>
                  )}
                </>
              ) : (
                <Button onClick={() => handleAction("vote")} disabled={!selectedPlayer} className="bg-yellow-500 hover:bg-yellow-600 text-white">Vote</Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}