import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Edit2, Trash2, Command } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CustomCommand {
  id: number;
  name: string;
  trigger: string;
  promptTemplate: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomCommandFormData {
  name: string;
  trigger: string;
  promptTemplate: string;
  description?: string;
  isActive: boolean;
}

const defaultFormData: CustomCommandFormData = {
  name: '',
  trigger: '/',
  promptTemplate: '',
  description: '',
  isActive: true
};

export default function CustomCommandEditor() {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
  const [formData, setFormData] = useState<CustomCommandFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Load custom commands
  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', '/custom-commands');
      const commands = await response.json() as CustomCommand[];
      setCommands(commands);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load custom commands',
        variant: 'destructive'
      });
      console.error('Error loading commands:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingCommand(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (command: CustomCommand) => {
    setEditingCommand(command);
    setFormData({
      name: command.name,
      trigger: command.trigger,
      promptTemplate: command.promptTemplate,
      description: command.description || '',
      isActive: command.isActive
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCommand(null);
    setFormData(defaultFormData);
  };

  const handleInputChange = (field: keyof CustomCommandFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) {
      errors.push('Name is required');
    }
    
    if (!formData.trigger.trim() || !formData.trigger.startsWith('/')) {
      errors.push('Trigger must start with / and be at least 2 characters');
    }
    
    if (formData.trigger.length < 2) {
      errors.push('Trigger must be at least 2 characters');
    }
    
    if (!formData.promptTemplate.trim()) {
      errors.push('Prompt template is required');
    }
    
    // Check for reserved commands
    const reservedCommands = ['/continue', '/improve', '/fix', '/bullets', '/table', '/format'];
    if (reservedCommands.includes(formData.trigger)) {
      errors.push(`Trigger "${formData.trigger}" is reserved for core commands`);
    }
    
    // Check for duplicate triggers (excluding current command if editing)
    const existingCommand = commands.find(cmd => 
      cmd.trigger === formData.trigger && cmd.id !== editingCommand?.id
    );
    if (existingCommand) {
      errors.push(`Trigger "${formData.trigger}" is already in use`);
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: errors.join(', '),
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingCommand) {
        // Update existing command
        await apiRequest('PUT', `/custom-commands/${editingCommand.id}`, formData);
        toast({
          title: 'Success',
          description: 'Custom command updated successfully'
        });
      } else {
        // Create new command
        await apiRequest('POST', '/custom-commands', formData);
        toast({
          title: 'Success',
          description: 'Custom command created successfully'
        });
      }
      
      closeDialog();
      loadCommands();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save custom command',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (command: CustomCommand) => {
    if (!confirm(`Are you sure you want to delete the "${command.name}" command?`)) {
      return;
    }

    try {
      await apiRequest('DELETE', `/custom-commands/${command.id}`);
      toast({
        title: 'Success',
        description: 'Custom command deleted successfully'
      });
      loadCommands();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete custom command',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (command: CustomCommand) => {
    try {
      await apiRequest('PUT', `/custom-commands/${command.id}`, {
        isActive: !command.isActive
      });
      loadCommands();
    } catch (error: any) {
      toast({
        title: 'Error', 
        description: error.message || 'Failed to update command status',
        variant: 'destructive'
      });
    }
  };

  const coreCommands = [
    { name: 'Continue', trigger: '/continue', description: 'Extend writing seamlessly' },
    { name: 'Improve', trigger: '/improve', description: 'Enhance selected text' },
    { name: 'Fix', trigger: '/fix', description: 'Fix grammar and spelling' },
    { name: 'Bullets', trigger: '/bullets', description: 'Convert to bullet points' },
    { name: 'Table', trigger: '/table', description: 'Convert to table format' },
    { name: 'Format', trigger: '/format', description: 'Improve structure and formatting' }
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Slash Commands</h2>
          <p className="text-gray-600">Manage your core and custom slash commands</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Command
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCommand ? 'Edit Custom Command' : 'Create Custom Command'}
              </DialogTitle>
              <DialogDescription>
                {editingCommand ? 'Update your custom command details.' : 'Create a personalized slash command for your writing workflow.'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Command Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Academic, Professional, Blog"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trigger">Trigger</Label>
                  <Input
                    id="trigger"
                    value={formData.trigger}
                    onChange={(e) => handleInputChange('trigger', e.target.value)}
                    placeholder="e.g., /academic, /pro, /blog"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Brief description of what this command does"
                />
              </div>
              
              <div>
                <Label htmlFor="promptTemplate">Prompt Template</Label>
                <Textarea
                  id="promptTemplate"
                  value={formData.promptTemplate}
                  onChange={(e) => handleInputChange('promptTemplate', e.target.value)}
                  placeholder="e.g., Rewrite the text in a formal academic tone using scholarly vocabulary, precise language, and analytical approach suitable for academic or research contexts."
                  rows={4}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  This is the instruction that will be sent to the AI when the command is used.
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : (editingCommand ? 'Update' : 'Create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Core Commands */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Command className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Core Commands</h3>
          <Badge variant="secondary">Built-in</Badge>
        </div>
        <div className="grid gap-3">
          {coreCommands.map((command) => (
            <Card key={command.trigger} className="border border-blue-100 bg-blue-50/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono bg-blue-100 px-2 py-1 rounded">
                        {command.trigger}
                      </code>
                      <span className="font-medium">{command.name}</span>
                    </div>
                    <p className="text-sm text-gray-600">{command.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Custom Commands */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Edit2 className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Your Custom Commands</h3>
          <Badge variant="outline">{commands.length}</Badge>
        </div>

        {commands.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Command className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h4 className="text-lg font-semibold mb-2">No Custom Commands Yet</h4>
              <p className="text-gray-600 mb-4">
                Create custom slash commands tailored to your writing style and workflow.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Command
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {commands.map((command) => (
              <Card key={command.id} className={`${command.isActive ? '' : 'opacity-60'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {command.trigger}
                        </code>
                        <span className="font-medium">{command.name}</span>
                        {!command.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      {command.description && (
                        <p className="text-sm text-gray-600 mb-2">{command.description}</p>
                      )}
                      <p className="text-xs text-gray-500 font-mono">
                        {command.promptTemplate.length > 120 
                          ? command.promptTemplate.substring(0, 120) + '...' 
                          : command.promptTemplate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={command.isActive}
                        onCheckedChange={() => handleToggleActive(command)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(command)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(command)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}